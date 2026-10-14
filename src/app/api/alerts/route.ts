import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { PriceAlertType, Prisma } from "@prisma/client";

const CreateAlertSchema = z.object({
  gameId: z.string().min(1),
  type: z.nativeEnum(PriceAlertType),
  targetPrice: z.number().positive().optional(),
  targetDiscount: z.number().min(1).max(100).optional(),
  targetDealScore: z.number().min(1).max(100).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: user.userId },
    include: {
      game: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          currentPrice: true,
          listPrice: true,
          discountPercent: true,
          historicalLow: true,
          dealAnalysis: { select: { dealScore: true, verdict: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CreateAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Geçersiz veri." }, { status: 400 });
    }

    const { gameId, type, targetPrice, targetDiscount, targetDealScore } = parsed.data;

    if (type === PriceAlertType.PRICE_BELOW && (!targetPrice || targetPrice <= 0)) {
      return NextResponse.json(
        { error: "Hedef fiyat sıfırdan büyük bir değer olmalıdır." },
        { status: 400 }
      );
    }

    if (type === PriceAlertType.DISCOUNT_AT_LEAST && (!targetDiscount || targetDiscount < 1)) {
      return NextResponse.json(
        { error: "Hedef indirim oranı en az %1 olmalıdır." },
        { status: 400 }
      );
    }

    if (type === PriceAlertType.DEAL_SCORE_AT_LEAST && (!targetDealScore || targetDealScore < 1)) {
      return NextResponse.json(
        { error: "Hedef fırsat skoru en az 1 olmalıdır." },
        { status: 400 }
      );
    }

    const existingAlert = await prisma.priceAlert.findFirst({
      where: {
        userId: user.userId,
        gameId,
      },
    });

    const alert = existingAlert
      ? await prisma.priceAlert.update({
          where: { id: existingAlert.id },
          data: {
            type,
            targetPrice: targetPrice ? new Prisma.Decimal(targetPrice) : null,
            targetDiscount: targetDiscount || null,
            targetDealScore: targetDealScore || null,
            isEnabled: true,
          },
        })
      : await prisma.priceAlert.create({
          data: {
            userId: user.userId,
            gameId,
            type,
            targetPrice: targetPrice ? new Prisma.Decimal(targetPrice) : null,
            targetDiscount: targetDiscount || null,
            targetDealScore: targetDealScore || null,
            isEnabled: true,
          },
        });

    return NextResponse.json({ success: true, alert });
  } catch (err: any) {
    console.error("[Alert Create Error]", err);
    return NextResponse.json({ error: "Alarm oluşturulamadı." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const alertId = searchParams.get("id");

  if (!alertId) {
    return NextResponse.json({ error: "Alarm ID gereklidir." }, { status: 400 });
  }

  const alert = await prisma.priceAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert || alert.userId !== user.userId) {
    return NextResponse.json({ error: "Alarm bulunamadı." }, { status: 404 });
  }

  await prisma.priceAlert.delete({
    where: { id: alertId },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const body = await req.json();
  const { alertId, isEnabled } = body;

  const alert = await prisma.priceAlert.findUnique({
    where: { id: alertId },
  });

  if (!alert || alert.userId !== user.userId) {
    return NextResponse.json({ error: "Alarm bulunamadı." }, { status: 404 });
  }

  const updated = await prisma.priceAlert.update({
    where: { id: alertId },
    data: { isEnabled: Boolean(isEnabled) },
  });

  return NextResponse.json({ success: true, alert: updated });
}
