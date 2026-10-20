import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProductClass } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();
  } catch (err: any) {
    return NextResponse.json({ error: "Yetkisiz erişim. Sadece OWNER rolü erişebilir." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");

  // Mode 1: Detailed price history timeline for a single game (Drawer / Modal)
  if (gameId) {
    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: {
          id: true,
          xboxProductId: true,
          title: true,
          slug: true,
          imageUrl: true,
          productClass: true,
          platforms: true,
          currentPrice: true,
          listPrice: true,
          discountPercent: true,
          historicalLow: true,
          historicalLowAt: true,
          lastSeenAt: true,
          storeUrl: true,
        },
      });

      if (!game) {
        return NextResponse.json({ error: "Oyun bulunamadı" }, { status: 404 });
      }

      const histories = await prisma.priceHistory.findMany({
        where: { gameId },
        orderBy: { observedAt: "desc" },
      });

      // Enrich timeline items with previous price comparison
      const timeline = histories.map((h, index) => {
        const nextOlder = histories[index + 1];
        const currentPrice = Number(h.currentPrice);
        const listPrice = Number(h.listPrice);
        let prevPrice = nextOlder ? Number(nextOlder.currentPrice) : (h.isOnSale && listPrice > currentPrice ? listPrice : currentPrice);
        let diff = Number((currentPrice - prevPrice).toFixed(2));
        let percent = prevPrice > 0 ? Math.round(((currentPrice - prevPrice) / prevPrice) * 100) : 0;

        return {
          id: h.id,
          observedAt: h.observedAt,
          currentPrice,
          listPrice,
          discountPercent: h.discountPercent,
          isOnSale: h.isOnSale,
          saleEndAt: h.saleEndAt,
          currency: h.currency,
          previousPrice: prevPrice,
          difference: diff,
          percentChange: percent,
        };
      });

      return NextResponse.json({
        success: true,
        game: {
          ...game,
          url: game.storeUrl,
          currentPrice: Number(game.currentPrice),
          listPrice: Number(game.listPrice),
          historicalLow: game.historicalLow ? Number(game.historicalLow) : null,
        },
        timeline,
      });
    } catch (err: any) {
      console.error("[PriceChanges API gameId Error]", err);
      return NextResponse.json({ error: "Oyun fiyat geçmişi alınamadı: " + err.message }, { status: 500 });
    }
  }

  // Mode 2: Paginated global price change log
  try {
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "25", 10)));
    const timeRange = searchParams.get("timeRange") || "all";
    const direction = searchParams.get("direction") || "all";
    const type = searchParams.get("type") || "all";
    const q = searchParams.get("q")?.trim() || "";

    const where: any = {
      game: {
        isActive: true,
      },
    };

    // 1. Time range filter
    const now = new Date();
    if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.observedAt = { gte: startOfDay };
    } else if (timeRange === "24h") {
      where.observedAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
    } else if (timeRange === "7d") {
      where.observedAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (timeRange === "30d") {
      where.observedAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }

    // 2. Product Class filter
    if (type === "games") {
      where.game.productClass = ProductClass.BASE_GAME;
    } else if (type === "bundles") {
      where.game.productClass = ProductClass.BUNDLE;
    } else if (type === "dlcs") {
      where.game.productClass = { in: [ProductClass.ADD_ON, ProductClass.DLC] };
    }

    // 3. Search query
    if (q) {
      where.game.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { xboxProductId: { contains: q, mode: "insensitive" } },
      ];
    }

    // 4. Direction filter at DB level
    if (direction === "drop") {
      where.OR = [
        { isOnSale: true },
        { discountPercent: { gt: 0 } },
      ];
    } else if (direction === "historical_low") {
      where.isOnSale = true;
      where.game.historicalLow = { gt: 0 };
    }

    // Query stats and paginated items in parallel
    const [
      totalCount,
      histories,
      totalRecorded,
      changes24h,
      activeDealsCount,
      historicalLowsRecorded,
    ] = await Promise.all([
      prisma.priceHistory.count({ where }),
      prisma.priceHistory.findMany({
        where,
        orderBy: { observedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          game: {
            select: {
              id: true,
              xboxProductId: true,
              title: true,
              slug: true,
              imageUrl: true,
              productClass: true,
              platforms: true,
              historicalLow: true,
              historicalLowAt: true,
              currentPrice: true,
              listPrice: true,
              discountPercent: true,
              storeUrl: true,
            },
          },
        },
      }),
      prisma.priceHistory.count(),
      prisma.priceHistory.count({
        where: { observedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.priceHistory.count({
        where: { isOnSale: true },
      }),
      prisma.game.count({
        where: { isActive: true, historicalLow: { gt: 0 }, discountPercent: { gt: 0 } },
      }),
    ]);

    // Enrich each item with immediate preceding PriceHistory record
    const enrichedItems = await Promise.all(
      histories.map(async (ph) => {
        const prev = await prisma.priceHistory.findFirst({
          where: {
            gameId: ph.gameId,
            observedAt: { lt: ph.observedAt },
          },
          orderBy: { observedAt: "desc" },
          select: {
            currentPrice: true,
            listPrice: true,
            discountPercent: true,
            isOnSale: true,
            observedAt: true,
          },
        });

        const currentPrice = Number(ph.currentPrice);
        const listPrice = Number(ph.listPrice);
        let prevPrice: number;
        let prevListPrice: number;
        let prevDiscountPercent: number;

        if (prev) {
          prevPrice = Number(prev.currentPrice);
          prevListPrice = Number(prev.listPrice);
          prevDiscountPercent = prev.discountPercent;
        } else {
          // First recorded observation
          if (ph.isOnSale && listPrice > currentPrice) {
            prevPrice = listPrice;
            prevListPrice = listPrice;
            prevDiscountPercent = 0;
          } else {
            prevPrice = currentPrice;
            prevListPrice = listPrice;
            prevDiscountPercent = 0;
          }
        }

        const diff = Number((currentPrice - prevPrice).toFixed(2));
        let percentChange = 0;
        if (prevPrice > 0) {
          percentChange = Math.round(((currentPrice - prevPrice) / prevPrice) * 100);
        } else if (currentPrice > 0 && prevPrice === 0) {
          percentChange = 100;
        }

        let directionType: "drop" | "increase" | "initial" | "unchanged" = "unchanged";
        if (!prev) {
          directionType = ph.isOnSale ? "drop" : "initial";
        } else if (currentPrice < prevPrice) {
          directionType = "drop";
        } else if (currentPrice > prevPrice) {
          directionType = "increase";
        }

        const histLow = ph.game?.historicalLow ? Number(ph.game.historicalLow) : null;
        const isHistoricalLow =
          histLow !== null &&
          histLow > 0 &&
          currentPrice <= histLow + 0.01 &&
          currentPrice > 0;

        return {
          id: ph.id,
          gameId: ph.gameId,
          game: {
            id: ph.game.id,
            xboxProductId: ph.game.xboxProductId,
            title: ph.game.title,
            slug: ph.game.slug,
            imageUrl: ph.game.imageUrl,
            productClass: ph.game.productClass,
            platforms: ph.game.platforms,
            url: ph.game.storeUrl,
            historicalLow: histLow,
          },
          currentPrice,
          listPrice,
          discountPercent: ph.discountPercent,
          isOnSale: ph.isOnSale,
          saleEndAt: ph.saleEndAt,
          currency: ph.currency,
          observedAt: ph.observedAt,
          previousPrice: prevPrice,
          previousListPrice: prevListPrice,
          previousDiscountPercent: prevDiscountPercent,
          hasPrevious: Boolean(prev),
          difference: diff,
          percentChange,
          directionType,
          isHistoricalLow,
        };
      })
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalRecorded,
        changes24h,
        activeDealsCount,
        historicalLowsRecorded,
      },
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      items: enrichedItems,
    });
  } catch (err: any) {
    console.error("[PriceChanges API Error]", err);
    return NextResponse.json({ error: "Fiyat değişiklikleri listelenirken hata oluştu: " + err.message }, { status: 500 });
  }
}
