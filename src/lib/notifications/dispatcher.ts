import { prisma } from "../db/prisma";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationStatus,
} from "@prisma/client";
import { getSystemSettings } from "../settings/system-settings";
import { isEmailConfigured, sendNotificationEmail } from "./email-provider";
import { isTelegramConfigured, sendTelegramMessage } from "./telegram-provider";
import { NotificationTemplateService, NotificationPayload } from "./template-service";
import { isQuietHourActive, calculateNextAllowedDeliveryTime } from "./quiet-hours";

// Exponential backoff intervals in milliseconds: 1m, 5m, 15m, 60m, 360m
const RETRY_BACKOFF_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];

/**
 * Sanitizes error messages to ensure no passwords, secrets, or tokens are logged.
 */
export function sanitizeDeliveryError(error: string): string {
  if (!error) return "Unknown delivery error";
  return error
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]")
    .replace(/(password|secret|key|token)=[^&\s]+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

/**
 * Enqueues delivery records for a newly created NotificationEvent based on user preferences.
 * Fully idempotent: will not create duplicate delivery rows for (eventId, channel).
 */
export async function enqueueEventDeliveries(
  eventId: string,
  db = prisma
): Promise<{ enqueuedChannels: NotificationChannel[] }> {
  const event = await db.notificationEvent.findUnique({
    where: { id: eventId },
    include: {
      user: {
        include: {
          notificationPreferences: true,
          notificationSettings: true,
          telegramConnection: true,
        },
      },
    },
  });

  if (!event || !event.user) {
    return { enqueuedChannels: [] };
  }

  const settings = await getSystemSettings();
  const user = event.user;
  const enqueued: NotificationChannel[] = [];

  // Helper to check user preference for an event type and channel (defaults to true)
  const eventPayload = (event.payload as any) || {};
  const matchingTypes: NotificationEventType[] =
    Array.isArray(eventPayload?.matchingEventTypes) && eventPayload.matchingEventTypes.length > 0
      ? eventPayload.matchingEventTypes
      : [event.type];

  const isUserPrefEnabled = (channel: NotificationChannel): boolean => {
    const matchingPrefs = user.notificationPreferences.filter(
      (p) => matchingTypes.includes(p.eventType) && p.channel === channel
    );
    if (matchingPrefs.length === 0) return true;
    return matchingPrefs.some((p) => p.enabled);
  };

  // 1. IN_APP Channel
  if (settings.inAppNotificationsEnabled && isUserPrefEnabled(NotificationChannel.IN_APP)) {
    try {
      await db.notificationDelivery.upsert({
        where: {
          eventId_channel: {
            eventId: event.id,
            channel: NotificationChannel.IN_APP,
          },
        },
        create: {
          eventId: event.id,
          userId: user.id,
          channel: NotificationChannel.IN_APP,
          status: NotificationDeliveryStatus.PENDING,
          nextAttemptAt: new Date(),
        },
        update: {},
      });
      enqueued.push(NotificationChannel.IN_APP);
    } catch {
      // Ignore conflict
    }
  }

  // 2. EMAIL Channel
  // Requires: global switch ON + SMTP configured + user verified email + user preference enabled
  const emailConfigured = isEmailConfigured();
  const emailVerified = Boolean(user.emailVerifiedAt);
  if (
    settings.emailNotificationsEnabled &&
    emailConfigured &&
    emailVerified &&
    isUserPrefEnabled(NotificationChannel.EMAIL)
  ) {
    try {
      await db.notificationDelivery.upsert({
        where: {
          eventId_channel: {
            eventId: event.id,
            channel: NotificationChannel.EMAIL,
          },
        },
        create: {
          eventId: event.id,
          userId: user.id,
          channel: NotificationChannel.EMAIL,
          status: NotificationDeliveryStatus.PENDING,
          nextAttemptAt: new Date(),
        },
        update: {},
      });
      enqueued.push(NotificationChannel.EMAIL);
    } catch {
      // Ignore conflict
    }
  }

  // 3. TELEGRAM Channel
  // Requires: global switch ON + bot configured + user active telegram connection + user preference enabled
  const telegramConfigured = isTelegramConfigured();
  const telegramConnected = Boolean(user.telegramConnection && user.telegramConnection.isActive);
  const telegramGlobalEnabled = settings.telegramNotificationsEnabled !== false;
  if (
    telegramGlobalEnabled &&
    telegramConfigured &&
    telegramConnected &&
    isUserPrefEnabled(NotificationChannel.TELEGRAM)
  ) {
    try {
      await db.notificationDelivery.upsert({
        where: {
          eventId_channel: {
            eventId: event.id,
            channel: NotificationChannel.TELEGRAM,
          },
        },
        create: {
          eventId: event.id,
          userId: user.id,
          channel: NotificationChannel.TELEGRAM,
          status: NotificationDeliveryStatus.PENDING,
          nextAttemptAt: new Date(),
        },
        update: {},
      });
      enqueued.push(NotificationChannel.TELEGRAM);
    } catch {
      // Ignore conflict
    }
  }

  return { enqueuedChannels: enqueued };
}

/**
 * Processes queued deliveries that are due for dispatch.
 * Run inside background worker tick.
 */
export async function processNotificationDeliveries(
  batchSize = 25,
  db = prisma
): Promise<{ processed: number; sent: number; retried: number; failed: number }> {
  const now = new Date();

  // Find due deliveries
  const dueDeliveries = await db.notificationDelivery.findMany({
    where: {
      status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.RETRYING] },
      nextAttemptAt: { lte: now },
    },
    take: batchSize,
    include: {
      event: true,
      user: {
        include: {
          notificationSettings: true,
          telegramConnection: true,
        },
      },
    },
    orderBy: { nextAttemptAt: "asc" },
  });

  if (dueDeliveries.length === 0) {
    return { processed: 0, sent: 0, retried: 0, failed: 0 };
  }

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const delivery of dueDeliveries) {
    const { event, user, channel } = delivery;
    const payload = event.payload as unknown as NotificationPayload;
    const userSettings = user.notificationSettings;

    // Check Quiet Hours for external channels (EMAIL / TELEGRAM)
    if (channel !== NotificationChannel.IN_APP && userSettings?.quietHoursEnabled) {
      const inQuietHours = isQuietHourActive(
        userSettings.quietHoursStart,
        userSettings.quietHoursEnd,
        userSettings.timezone || "Europe/Istanbul",
        now
      );

      if (inQuietHours) {
        const nextTime = calculateNextAllowedDeliveryTime(
          userSettings.quietHoursEnd,
          userSettings.timezone || "Europe/Istanbul",
          now
        );

        await db.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            nextAttemptAt: nextTime,
            status: NotificationDeliveryStatus.PENDING,
          },
        });
        continue;
      }
    }

    // Mark delivery as PROCESSING
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: NotificationDeliveryStatus.PROCESSING, lastAttemptAt: now },
    });

    try {
      if (channel === NotificationChannel.IN_APP) {
        // Render in-app template and upsert/merge UserNotification record to eliminate duplicates
        const rendered = NotificationTemplateService.renderInApp(event.type, payload);
        const existing = rendered.linkUrl
          ? await db.userNotification.findFirst({
              where: {
                userId: user.id,
                linkUrl: rendered.linkUrl,
                createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
              },
              orderBy: { createdAt: "desc" },
            })
          : null;

        if (existing) {
          const mergedBadges = Array.from(
            new Set([...(existing.badges || []), ...(rendered.badges || [])])
          );
          const isTarihiDip = rendered.title.toLowerCase().includes("tarihi dip");
          const isExistingDip = existing.title.toLowerCase().includes("tarihi dip");
          const title = isTarihiDip || !isExistingDip ? rendered.title : existing.title;

          await db.userNotification.update({
            where: { id: existing.id },
            data: {
              title,
              badges: mergedBadges,
            },
          });
        } else {
          await db.userNotification.create({
            data: {
              userId: user.id,
              eventId: event.id,
              title: rendered.title,
              message: rendered.body,
              badges: rendered.badges || [],
              linkUrl: rendered.linkUrl,
            },
          });
        }

        await db.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.SENT,
            sentAt: new Date(),
          },
        });
        sent++;
      } else if (channel === NotificationChannel.EMAIL) {
        const rendered = NotificationTemplateService.renderEmail(event.type, payload, user.email);
        const result = await sendNotificationEmail({
          to: user.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });

        if (result.success) {
          await db.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.SENT,
              sentAt: new Date(),
              providerMessageId: result.messageId || null,
            },
          });
          sent++;
        } else {
          // Handle failure
          const attempts = delivery.attemptCount + 1;
          const sanitizedError = sanitizeDeliveryError(result.error || "");
          console.error(`[Email Delivery Failed] Delivery ${delivery.id} to ${user.email}: ${sanitizedError}`);

          if (result.isTransient && attempts < delivery.maxAttempts) {
            const backoff = RETRY_BACKOFF_MS[attempts - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
            await db.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: NotificationDeliveryStatus.RETRYING,
                attemptCount: attempts,
                nextAttemptAt: new Date(Date.now() + backoff),
                lastErrorSummary: sanitizedError,
              },
            });
            retried++;
          } else {
            await db.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: NotificationDeliveryStatus.FAILED,
                attemptCount: attempts,
                lastErrorSummary: sanitizedError,
              },
            });
            failed++;
          }
        }
      } else if (channel === NotificationChannel.TELEGRAM) {
        if (!user.telegramConnection || !user.telegramConnection.isActive) {
          await db.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.FAILED,
              lastErrorSummary: "User Telegram account is not connected or inactive.",
            },
          });
          failed++;
          continue;
        }

        const rendered = NotificationTemplateService.renderTelegram(event.type, payload);
        const result = await sendTelegramMessage(
          user.telegramConnection.telegramChatId,
          rendered.text
        );

        if (result.success) {
          await db.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.SENT,
              sentAt: new Date(),
              providerMessageId: result.messageId || null,
            },
          });
          sent++;
        } else {
          const attempts = delivery.attemptCount + 1;
          const sanitizedError = sanitizeDeliveryError(result.error || "");
          console.error(`[Telegram Delivery Failed] Delivery ${delivery.id} to chat ${user.telegramConnection.telegramChatId}: ${sanitizedError}`);

          // If user blocked bot or chat deleted, mark TelegramConnection inactive
          if (result.isBlockedOrInactive) {
            await db.telegramConnection.update({
              where: { id: user.telegramConnection.id },
              data: { isActive: false },
            });
          }

          if (result.isTransient && attempts < delivery.maxAttempts) {
            const backoff = result.retryAfterSeconds
              ? result.retryAfterSeconds * 1000
              : RETRY_BACKOFF_MS[attempts - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];

            await db.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: NotificationDeliveryStatus.RETRYING,
                attemptCount: attempts,
                nextAttemptAt: new Date(Date.now() + backoff),
                lastErrorSummary: sanitizedError,
              },
            });
            retried++;
          } else {
            await db.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: NotificationDeliveryStatus.FAILED,
                attemptCount: attempts,
                lastErrorSummary: sanitizedError,
              },
            });
            failed++;
          }
        }
      }
    } catch (deliveryErr: any) {
      await db.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          lastErrorSummary: sanitizeDeliveryError(deliveryErr?.message || "Delivery exception"),
        },
      });
      failed++;
    }
  }

  // Update processed status on source NotificationEvents if all deliveries are resolved
  const processedEventIds = [...new Set(dueDeliveries.map((d) => d.eventId))];
  for (const eventId of processedEventIds) {
    const pendingCount = await db.notificationDelivery.count({
      where: {
        eventId,
        status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.PROCESSING, NotificationDeliveryStatus.RETRYING] },
      },
    });

    if (pendingCount === 0) {
      await db.notificationEvent.update({
        where: { id: eventId },
        data: {
          status: NotificationStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    }
  }

  return { processed: dueDeliveries.length, sent, retried, failed };
}
