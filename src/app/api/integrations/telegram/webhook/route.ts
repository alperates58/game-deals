import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyAndConsumeTelegramLinkToken } from "@/lib/notifications/token-service";
import { sendTelegramMessage } from "@/lib/notifications/telegram-provider";
import {
  renderTelegramHelpMessage,
  renderTelegramInvalidTokenMessage,
  renderTelegramLinkSuccessMessage,
  renderTelegramStopMessage,
} from "@/lib/notifications/template-service";

const TelegramWebhookSchema = z.object({
  message: z
    .object({
      message_id: z.number().optional(),
      chat: z.object({
        id: z.union([z.number(), z.string()]),
        type: z.string().optional(),
      }),
      text: z.string().optional(),
      from: z
        .object({
          id: z.union([z.number(), z.string()]).optional(),
          username: z.string().optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

function verifyWebhookSecret(headerSecret: string | null): boolean {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!configuredSecret || !headerSecret) {
    return false;
  }

  try {
    const a = Buffer.from(headerSecret);
    const b = Buffer.from(configuredSecret);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");

  // Constant-time compare validation
  if (!verifyWebhookSecret(secretHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = TelegramWebhookSchema.safeParse(body);

    if (!parsed.success || !parsed.data.message) {
      return NextResponse.json({ ok: true }); // Always return 200 to Telegram
    }

    const message = parsed.data.message;
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || "";
    const username = message.from?.username || null;
    const displayName =
      [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ").trim() ||
      null;

    // 1. Command: /start <token>
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const linkToken = parts[1]?.trim();

      if (!linkToken) {
        const helpMsg = renderTelegramHelpMessage();
        const helpRes = await sendTelegramMessage(chatId, helpMsg.text, {
          replyMarkup: helpMsg.replyMarkup,
        });
        if (!helpRes.success) {
          console.warn(
            `[Telegram Webhook] Help message delivery failed: code=${
              helpRes.isTransient ? "TRANSIENT" : "DELIVERY_ERROR"
            }`
          );
        }
        return NextResponse.json({ ok: true });
      }

      const userId = await verifyAndConsumeTelegramLinkToken(linkToken);

      if (!userId) {
        const invalidMsg = renderTelegramInvalidTokenMessage();
        const invalidRes = await sendTelegramMessage(chatId, invalidMsg.text, {
          replyMarkup: invalidMsg.replyMarkup,
        });
        if (!invalidRes.success) {
          console.warn(
            `[Telegram Webhook] Invalid token message delivery failed: code=${
              invalidRes.isTransient ? "TRANSIENT" : "DELIVERY_ERROR"
            }`
          );
        }
        return NextResponse.json({ ok: true });
      }

      // Upsert TelegramConnection
      await prisma.telegramConnection.upsert({
        where: { userId },
        create: {
          userId,
          telegramChatId: chatId,
          telegramUsername: username,
          displayName,
          isActive: true,
          lastVerifiedAt: new Date(),
        },
        update: {
          telegramChatId: chatId,
          telegramUsername: username,
          displayName,
          isActive: true,
          lastVerifiedAt: new Date(),
        },
      });

      // Send link confirmation with inline return keyboard
      const successMsg = renderTelegramLinkSuccessMessage();
      const sendResult = await sendTelegramMessage(chatId, successMsg.text, {
        replyMarkup: successMsg.replyMarkup,
      });

      if (!sendResult.success) {
        // DO NOT rollback TelegramConnection
        // DO NOT fail the webhook
        console.warn(
          `[Telegram Webhook] Link succeeded but confirmation delivery failed: code=${
            sendResult.isTransient ? "TRANSIENT" : "DELIVERY_ERROR"
          }`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Command: /stop
    if (text === "/stop") {
      await prisma.telegramConnection.updateMany({
        where: { telegramChatId: chatId },
        data: { isActive: false },
      });

      const stopMsg = renderTelegramStopMessage();
      const stopRes = await sendTelegramMessage(chatId, stopMsg.text, {
        replyMarkup: stopMsg.replyMarkup,
      });

      if (!stopRes.success) {
        console.warn(
          `[Telegram Webhook] Stop confirmation delivery failed: code=${
            stopRes.isTransient ? "TRANSIENT" : "DELIVERY_ERROR"
          }`
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook Error]", err?.message || err);
    return NextResponse.json({ ok: true }); // Return 200 so Telegram won't spam retry webhook
  }
}
