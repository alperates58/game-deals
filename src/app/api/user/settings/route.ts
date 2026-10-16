import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/notifications/email-provider";
import { isTelegramConfigured } from "@/lib/notifications/telegram-provider";
import { PriceAlertType } from "@prisma/client";

export async function GET() {
  try {
    const session = await requireActiveUser();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        membershipTier: true,
        accountStatus: true,
        emailVerifiedAt: true,
        createdAt: true,
        passwordHash: true,
        accounts: {
          select: { provider: true, providerAccountId: true },
        },
        telegramConnection: {
          select: {
            isActive: true,
            telegramUsername: true,
            displayName: true,
            linkedAt: true,
          },
        },
        notificationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const isGoogleLinked = user.accounts.some((a) => a.provider === "GOOGLE");
    const hasPassword = Boolean(user.passwordHash);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        membershipTier: user.membershipTier,
        accountStatus: user.accountStatus,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        isGoogleLinked,
        hasPassword,
      },
      telegramConnection: user.telegramConnection,
      notificationSettings: user.notificationSettings || {
        quietHoursEnabled: false,
        quietHoursStart: "23:00",
        quietHoursEnd: "08:00",
        timezone: "Europe/Istanbul",
        defaultAlertType: PriceAlertType.ANY_DISCOUNT,
        defaultLanguage: "tr-TR",
        defaultCurrency: "TRY",
      },
      providers: {
        emailConfigured: isEmailConfigured(),
        telegramConfigured: isTelegramConfigured(),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Kullanıcı ayarları yüklenemedi." }, { status: 500 });
  }
}

const UpdateSettingsSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır.").max(50).optional(),
  avatarUrl: z.string().url("Geçerli bir URL giriniz.").optional().nullable(),
  notificationSettings: z
    .object({
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Saat formatı HH:MM olmalıdır.").optional().nullable(),
      quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Saat formatı HH:MM olmalıdır.").optional().nullable(),
      timezone: z.string().min(1).default("Europe/Istanbul").optional(),
      defaultAlertType: z.nativeEnum(PriceAlertType).optional(),
      defaultLanguage: z.string().default("tr-TR").optional(),
      defaultCurrency: z.string().default("TRY").optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireActiveUser();
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz ayar verisi." },
        { status: 400 }
      );
    }

    const { name, avatarUrl, notificationSettings } = parsed.data;

    // Update User profile
    const userUpdate: any = {};
    if (name !== undefined) userUpdate.name = name;
    if (avatarUrl !== undefined) userUpdate.avatarUrl = avatarUrl;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: session.userId },
        data: userUpdate,
      });
    }

    // Upsert UserNotificationSettings
    if (notificationSettings) {
      await prisma.userNotificationSettings.upsert({
        where: { userId: session.userId },
        create: {
          userId: session.userId,
          quietHoursEnabled: notificationSettings.quietHoursEnabled ?? false,
          quietHoursStart: notificationSettings.quietHoursStart ?? "23:00",
          quietHoursEnd: notificationSettings.quietHoursEnd ?? "08:00",
          timezone: notificationSettings.timezone || "Europe/Istanbul",
          defaultAlertType: notificationSettings.defaultAlertType || PriceAlertType.ANY_DISCOUNT,
          defaultLanguage: notificationSettings.defaultLanguage || "tr-TR",
          defaultCurrency: notificationSettings.defaultCurrency || "TRY",
        },
        update: {
          ...(notificationSettings.quietHoursEnabled !== undefined && {
            quietHoursEnabled: notificationSettings.quietHoursEnabled,
          }),
          ...(notificationSettings.quietHoursStart !== undefined && {
            quietHoursStart: notificationSettings.quietHoursStart,
          }),
          ...(notificationSettings.quietHoursEnd !== undefined && {
            quietHoursEnd: notificationSettings.quietHoursEnd,
          }),
          ...(notificationSettings.timezone !== undefined && {
            timezone: notificationSettings.timezone,
          }),
          ...(notificationSettings.defaultAlertType !== undefined && {
            defaultAlertType: notificationSettings.defaultAlertType,
          }),
          ...(notificationSettings.defaultLanguage !== undefined && {
            defaultLanguage: notificationSettings.defaultLanguage,
          }),
          ...(notificationSettings.defaultCurrency !== undefined && {
            defaultCurrency: notificationSettings.defaultCurrency,
          }),
        },
      });
    }

    return NextResponse.json({ success: true, message: "Ayarlar başarıyla güncellendi." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }
}
