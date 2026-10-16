import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createEmailVerificationToken } from "@/lib/notifications/token-service";
import { sendNotificationEmail, isEmailConfigured } from "@/lib/notifications/email-provider";

const lastEmailSentTimestamp = new Map<string, number>();

export async function POST() {
  try {
    const user = await requireActiveUser();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, emailVerifiedAt: true, name: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    if (dbUser.emailVerifiedAt) {
      return NextResponse.json({ error: "E-posta adresiniz zaten doğrulanmış." }, { status: 400 });
    }

    // Cooldown check (60 seconds)
    const lastSent = lastEmailSentTimestamp.get(user.userId);
    const now = Date.now();
    if (lastSent && now - lastSent < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - lastSent)) / 1000);
      return NextResponse.json(
        { error: `Lütfen tekrar doğrulama bağlantısı istemek için ${waitSeconds} saniye bekleyin.` },
        { status: 429 }
      );
    }

    const { token } = await createEmailVerificationToken(user.userId);
    const appUrl = process.env.APP_URL || "https://game.alperates.com.tr";
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    if (isEmailConfigured()) {
      await sendNotificationEmail({
        to: dbUser.email,
        subject: "[Game Deals] E-posta Adresinizi Doğrulayın",
        text: `Merhaba ${dbUser.name},\n\nGame Deals hesabınızda e-posta bildirimlerini etkinleştirmek için lütfen aşağıdaki bağlantıya tıklayınız:\n${verifyUrl}\n\nBu bağlantı 30 dakika geçerlidir.`,
        html: `
          <div style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #27272a;">
            <h2 style="color: #ffffff; margin-top: 0;">E-posta Doğrulama</h2>
            <p>Merhaba <strong>${dbUser.name}</strong>,</p>
            <p>Game Deals hesabınızda fiyat alarmı ve indirim e-postalarını alabilmek için lütfen adresinizi doğrulayın:</p>
            <p style="margin: 24px 0;">
              <a href="${verifyUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">E-postamı Doğrula</a>
            </p>
            <p style="font-size: 12px; color: #71717a;">Bu bağlantı 30 dakika boyunca geçerlidir. Eğer bu talebi siz yapmadıysanız bu mesajı görmezden gelebilirsiniz.</p>
          </div>
        `,
      });
    }

    lastEmailSentTimestamp.set(user.userId, now);
    return NextResponse.json({
      success: true,
      message: "Doğrulama bağlantısı e-posta adresinize gönderildi.",
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi." }, { status: 500 });
  }
}
