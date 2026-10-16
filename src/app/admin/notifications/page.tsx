import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getEmailConfigStatus } from "@/lib/notifications/email-provider";
import { getTelegramConfigStatus } from "@/lib/notifications/telegram-provider";
import { NotificationProvidersClient } from "@/components/admin/notifications/notification-providers-client";
import { Bell } from "lucide-react";
import { NotificationDeliveryStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Bildirim Kanalları & Sağlayıcılar | Admin",
  description: "SMTP E-posta, Telegram Botu ve Site İçi bildirim sağlayıcı durumları.",
};

export default async function AdminNotificationsPage() {
  await requireOwner();

  const emailCfg = getEmailConfigStatus();
  const telegramCfg = getTelegramConfigStatus();

  const [
    totalDeliveries,
    pendingDeliveries,
    sentDeliveries,
    failedDeliveries,
    totalInApp,
    activeTelegramSubs,
  ] = await Promise.all([
    prisma.notificationDelivery.count(),
    prisma.notificationDelivery.count({
      where: {
        status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.PROCESSING] },
      },
    }),
    prisma.notificationDelivery.count({
      where: { status: NotificationDeliveryStatus.SENT },
    }),
    prisma.notificationDelivery.count({
      where: {
        status: {
          in: [NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.RETRYING],
        },
      },
    }),
    prisma.userNotification.count(),
    prisma.telegramConnection.count({ where: { isActive: true } }),
  ]);

  const emailUserMasked = emailCfg.userMasked || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Bell className="h-4 w-4" />
            <span>Operasyon</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bildirim Kanalları & Sağlayıcılar</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            SMTP e-posta sunucusu, Telegram bot entegrasyonu ve anlık bildirim durumu.
          </p>
        </div>
      </div>

      <NotificationProvidersClient
        email={{
          isConfigured: emailCfg.configured,
          host: emailCfg.host || "Belirtilmemiş",
          port: emailCfg.port || 587,
          userMasked: emailUserMasked,
          fromAddress: emailCfg.fromAddress || "info@gamedeals.com",
        }}
        telegram={{
          isConfigured: telegramCfg.configured,
          botUsername: telegramCfg.botUsername ? `@${telegramCfg.botUsername}` : "Belirtilmemiş",
          webhookUrl: telegramCfg.configured
            ? "/api/integrations/telegram/webhook"
            : "Eksik TELEGRAM_BOT_TOKEN",
          activeSubscribers: activeTelegramSubs,
        }}
        stats={{
          totalDeliveries,
          pendingDeliveries,
          sentDeliveries,
          failedDeliveries,
          totalInApp,
        }}
      />
    </div>
  );
}
