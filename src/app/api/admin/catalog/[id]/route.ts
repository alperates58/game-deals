import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
    const { id } = await params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        priceHistories: {
          orderBy: { observedAt: "desc" },
          take: 50,
        },
        manualOverride: {
          include: {
            updatedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        ratings: true,
        subscriptions: true,
        languageSupports: true,
        mediaItems: {
          orderBy: { position: "asc" },
        },
        childRelations: {
          include: {
            childGame: {
              select: { id: true, title: true, productClass: true, imageUrl: true },
            },
          },
        },
        parentRelations: {
          include: {
            parentGame: {
              select: { id: true, title: true, productClass: true, imageUrl: true },
            },
          },
        },
        _count: {
          select: {
            userGames: true,
            priceAlerts: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Oyun bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (error: any) {
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Admin catalog get error:", error);
    return NextResponse.json({ error: "Oyun bilgisi alınırken hata oluştu" }, { status: 500 });
  }
}
