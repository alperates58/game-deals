import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProductClass } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const productClass = searchParams.get("productClass") as ProductClass | null;
    const hasDiscount = searchParams.get("hasDiscount") === "true";
    const hasOverride = searchParams.get("hasOverride") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "25")));

    const where: any = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    if (productClass && Object.values(ProductClass).includes(productClass)) {
      where.productClass = productClass;
    }

    if (hasDiscount) {
      where.discountPercent = { gt: 0 };
    }

    if (hasOverride) {
      where.manualOverride = { isNot: null };
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          manualOverride: true,
          _count: {
            select: {
              childRelations: true,
              parentRelations: true,
              ratings: true,
              subscriptions: true,
            },
          },
        },
      }),
      prisma.game.count({ where }),
    ]);

    const formattedGames = games.map((g) => {
      return {
        id: g.id,
        title: g.title,
        slug: g.slug,
        productClass: g.productClass,
        developer: g.developer,
        publisher: g.publisher,
        releaseDate: g.releaseDate ? g.releaseDate.toISOString() : null,
        imageUrl: g.imageUrl,
        isActive: g.isActive,
        updatedAt: g.updatedAt.toISOString(),
        hasManualOverride: Boolean(g.manualOverride),
        manualOverride: g.manualOverride,
        counts: {
          childRelationships: g._count.childRelations,
          parentRelationships: g._count.parentRelations,
          externalRatings: g._count.ratings,
          subscriptions: g._count.subscriptions,
        },
        price: {
          originalPrice: Number(g.listPrice),
          currentPrice: Number(g.currentPrice),
          discountPercent: g.discountPercent,
          currency: g.currency,
          isFree: g.isFree,
        },
      };
    });

    return NextResponse.json({
      games: formattedGames,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Admin catalog list error:", error);
    return NextResponse.json({ error: "Katalog listelenirken hata oluştu" }, { status: 500 });
  }
}
