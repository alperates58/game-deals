import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { createTelegramLinkToken } from "@/lib/notifications/token-service";
import { isTelegramConfigured } from "@/lib/notifications/telegram-provider";

export async function POST() {
  try {
    const user = await requireActiveUser();

    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { error: "Telegram botu şu anda sistem yöneticisi tarafından yapılandırılmamıştır." },
        { status: 503 }
      );
    }

    const { token } = await createTelegramLinkToken(user.userId);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    const linkUrl = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      success: true,
      botUsername,
      linkUrl,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    if (err.message === "ACCOUNT_SUSPENDED") {
      return NextResponse.json({ error: "Hesabınız askıya alınmıştır." }, { status: 403 });
    }
    return NextResponse.json({ error: "Bağlantı tokeni oluşturulamadı." }, { status: 500 });
  }
}
