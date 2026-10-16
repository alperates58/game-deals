import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendNotificationEmail, isEmailConfigured } from "@/lib/notifications/email-provider";

const lastEmailTestTimestamp = new Map<string, number>();

export async function POST() {
  try {
    const user = await requireActiveUser();

    // 60-second cooldown
    const lastTest = lastEmailTestTimestamp.get(user.userId);
    const now = Date.now();
    if (lastTest && now - lastTest < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - lastTest)) / 1000);
      return NextResponse.json(
        { error: `Lütfen tekrar test e-postası göndermek için ${waitSeconds} saniye bekleyin.` },
        { status: 429 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "E-posta sunucusu (SMTP) sistem yöneticisi tarafından henüz yapılandırılmamıştır." },
        { status: 503 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, emailVerifiedAt: true, name: true },
    });

    if (!dbUser || !dbUser.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Test e-postası alabilmek için önce e-posta adresinizi doğrulamanız gerekmektedir." },
        { status: 400 }
      );
    }

    const result = await sendNotificationEmail({
      to: dbUser.email,
      subject: "[Game Deals] Test Bildirimi",
      text: `Merhaba ${dbUser.name},\n\nBu bir Game Deals test e-postasıdır. E-posta bildirim sisteminiz kusursuz çalışmaktadır!`,
      html: `
        <div style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #27272a;">
          <h2 style="color: #10b981; margin-top: 0;">Test Bildirimi Başarılı</h2>
          <p>Merhaba <strong>${dbUser.name}</strong>,</p>
          <p>Game Deals e-posta bildirim entegrasyonunuz aktif ve sorunsuz çalışıyor.</p>
          <p style="font-size: 12px; color: #71717a;">Bildirim tercihlerinizi dilediğiniz an Ayarlar sayfasından düzenleyebilirsiniz.</p>
        </div>
      `,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "E-posta gönderilemedi." },
        { status: 502 }
      );
    }

    lastEmailTestTimestamp.set(user.userId, now);
    return NextResponse.json({ success: true, message: "Test e-postası adresinize gönderildi!" });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Test e-postası gönderilemedi." }, { status: 500 });
  }
}
