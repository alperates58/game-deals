import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendTelegramMessage } from "@/lib/notifications/telegram-provider";

const lastTestTimestamp = new Map<string, number>();

export async function POST() {
  try {
    const user = await requireActiveUser();

    // 60-second cooldown per user
    const lastTest = lastTestTimestamp.get(user.userId);
    const now = Date.now();
    if (lastTest && now - lastTest < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - lastTest)) / 1000);
      return NextResponse.json(
        { error: `Lütfen tekrar test mesajı göndermek için ${waitSeconds} saniye bekleyin.` },
        { status: 429 }
      );
    }

    const connection = await prisma.telegramConnection.findUnique({
      where: { userId: user.userId },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "Telegram hesabınız bağlı veya aktif değil." },
        { status: 400 }
      );
    }

    const result = await sendTelegramMessage(
      connection.telegramChatId,
      "🔔 *Game Deals Test Bildirimi*\\n\\nTelegram entegrasyonunuz kusursuz çalışıyor! Yeni indirimler ve alarmlarınız bu kanaldan iletilecektir\\."
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Telegram mesajı gönderilemedi." },
        { status: 502 }
      );
    }

    lastTestTimestamp.set(user.userId, now);
    return NextResponse.json({ success: true, message: "Test bildirimi Telegram hesabınıza gönderildi!" });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Test gönderimi başarısız oldu." }, { status: 500 });
  }
}
