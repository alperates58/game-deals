import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth/session";
import { NotificationChannel, NotificationEventType } from "@prisma/client";

const ALL_EVENT_TYPES = Object.values(NotificationEventType);
const ALL_CHANNELS = Object.values(NotificationChannel);

export async function GET() {
  try {
    const session = await requireActiveUser();

    const [preferences, user] = await Promise.all([
      prisma.userNotificationPreference.findMany({
        where: { userId: session.userId },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          emailVerifiedAt: true,
          telegramConnection: { select: { isActive: true } },
        },
      }),
    ]);

    // Build matrix with defaults
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const evt of ALL_EVENT_TYPES) {
      matrix[evt] = {};
      for (const ch of ALL_CHANNELS) {
        const found = preferences.find((p) => p.eventType === evt && p.channel === ch);
        matrix[evt][ch] = found ? found.enabled : true; // Default enabled
      }
    }

    return NextResponse.json({
      success: true,
      matrix,
      capabilities: {
        canEnableEmail: Boolean(user?.emailVerifiedAt),
        canEnableTelegram: Boolean(user?.telegramConnection?.isActive),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Tercihler alınamadı." }, { status: 500 });
  }
}

const PutPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      eventType: z.nativeEnum(NotificationEventType),
      channel: z.nativeEnum(NotificationChannel),
      enabled: z.boolean(),
    })
  ),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireActiveUser();
    const body = await req.json();
    const parsed = PutPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz tercih verisi." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        emailVerifiedAt: true,
        telegramConnection: { select: { isActive: true } },
      },
    });

    // Validate channel prerequisites
    for (const pref of parsed.data.preferences) {
      if (pref.channel === NotificationChannel.EMAIL && pref.enabled && !user?.emailVerifiedAt) {
        return NextResponse.json(
          { error: "E-posta bildirimlerini açabilmek için lütfen önce e-posta adresinizi doğrulayın." },
          { status: 400 }
        );
      }

      if (
        pref.channel === NotificationChannel.TELEGRAM &&
        pref.enabled &&
        !user?.telegramConnection?.isActive
      ) {
        return NextResponse.json(
          { error: "Telegram bildirimlerini açabilmek için lütfen önce Telegram hesabınızı bağlayın." },
          { status: 400 }
        );
      }
    }

    // Save preferences in a transaction
    await prisma.$transaction(
      parsed.data.preferences.map((pref) =>
        prisma.userNotificationPreference.upsert({
          where: {
            userId_eventType_channel: {
              userId: session.userId,
              eventType: pref.eventType,
              channel: pref.channel,
            },
          },
          create: {
            userId: session.userId,
            eventType: pref.eventType,
            channel: pref.channel,
            enabled: pref.enabled,
          },
          update: {
            enabled: pref.enabled,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: "Bildirim tercihleriniz güncellendi.",
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Tercihler kaydedilemedi." }, { status: 500 });
  }
}
