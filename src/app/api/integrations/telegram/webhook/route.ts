import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyAndConsumeTelegramLinkToken } from "@/lib/notifications/token-service";
import { sendTelegramMessage } from "@/lib/notifications/telegram-provider";

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
    const displayName = [message.from?.first_name, message.from?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || null;

    // 1. Command: /start <token>
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const linkToken = parts[1]?.trim();

      if (!linkToken) {
        await sendTelegramMessage(
          chatId,
          "👋 *Merhaba!* Game Deals bildirimlerini almak için web sitesindeki [Ayarlar](https://game.alperates.com.tr/ayarlar) sayfasından hesabınızı bağlamanız gerekmektedir."
        );
        return NextResponse.json({ ok: true });
      }

      const userId = await verifyAndConsumeTelegramLinkToken(linkToken);

      if (!userId) {
        await sendTelegramMessage(
          chatId,
          "❌ *Geçersiz veya Süresi Dolmuş Bağlantı!*\\nLütfen [Ayarlar](https://game.alperates.com.tr/ayarlar) sayfasından yeni bir Telegram bağlantısı başlatın."
        );
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

      await sendTelegramMessage(
        chatId,
        "🎮 *Tebrikler! Game Deals hesabınız başarıyla bağlandı.*\\n\\nFiyat alarmlarınız, tarihi dip fırsatları ve istek listenizdeki oyun indirimleri anında buradan size iletilecektir\\."
      );

      return NextResponse.json({ ok: true });
    }

    // 2. Command: /stop
    if (text === "/stop") {
      await prisma.telegramConnection.updateMany({
        where: { telegramChatId: chatId },
        data: { isActive: false },
      });

      await sendTelegramMessage(
        chatId,
        "🛑 *Bildirimler Durduruldu.*\\nGame Deals bildirimleriniz askıya alındı. Tekrar etkinleştirmek için web sitemizdeki [Ayarlar](https://game.alperates.com.tr/ayarlar) sayfasını ziyaret edebilirsiniz."
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook Error]", err?.message || err);
    return NextResponse.json({ ok: true }); // Return 200 so Telegram won't spam retry webhook
  }
}
