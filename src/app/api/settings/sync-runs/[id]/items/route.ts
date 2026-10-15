import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";
import { ProductClass } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu logları yalnızca sistem yöneticisi (OWNER) görüntüleyebilir." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const run = await prisma.syncRun.findUnique({
      where: { id },
    });

    if (!run) {
      return NextResponse.json({ error: "Tarama kaydı bulunamadı." }, { status: 404 });
    }

    const type = searchParams.get("type") || "added"; // "added" | "updated"
    const category = searchParams.get("category") || "all"; // "all" | "games" | "dlcs" | "bundles"
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "48", 10)));
    const skip = (page - 1) * limit;

    const windowStart = new Date(run.startedAt.getTime() - 5000);
    const windowEnd = run.finishedAt
      ? new Date(run.finishedAt.getTime() + 5000)
      : new Date();

    const dlcClasses: ProductClass[] = [
      ProductClass.DLC,
      ProductClass.ADD_ON,
      ProductClass.EXPANSION,
      ProductClass.SEASON_PASS,
      ProductClass.CONTENT_PACK,
    ];

    if (type === "added") {
      // Base where clause for items created in this run
      const baseWhere: any = {
        createdAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      };

      // Get count breakdown across all categories for this run
      const [totalAdded, gamesCount, dlcsCount, bundlesCount] = await Promise.all([
        prisma.game.count({ where: baseWhere }),
        prisma.game.count({ where: { ...baseWhere, productClass: ProductClass.BASE_GAME } }),
        prisma.game.count({ where: { ...baseWhere, productClass: { in: dlcClasses } } }),
        prisma.game.count({ where: { ...baseWhere, productClass: ProductClass.BUNDLE } }),
      ]);

      // Filtered query based on selected category & search query
      const filterWhere: any = { ...baseWhere };

      if (category === "games") {
        filterWhere.productClass = ProductClass.BASE_GAME;
      } else if (category === "dlcs") {
        filterWhere.productClass = { in: dlcClasses };
      } else if (category === "bundles") {
        filterWhere.productClass = ProductClass.BUNDLE;
      }

      if (q) {
        filterWhere.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { normalizedTitle: { contains: q, mode: "insensitive" } },
          { xboxProductId: { contains: q, mode: "insensitive" } },
        ];
      }

      const [filteredTotal, games] = await Promise.all([
        prisma.game.count({ where: filterWhere }),
        prisma.game.findMany({
          where: filterWhere,
          select: {
            id: true,
            xboxProductId: true,
            title: true,
            slug: true,
            imageUrl: true,
            productClass: true,
            currentPrice: true,
            listPrice: true,
            discountPercent: true,
            platforms: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      // If DB has 0 items from timestamp (e.g. historical run), try fallback to errorSummary JSON
      if (totalAdded === 0 && run.errorSummary && run.errorSummary.startsWith("{")) {
        try {
          const parsed = JSON.parse(run.errorSummary);
          if (Array.isArray(parsed.addedGames) && parsed.addedGames.length > 0) {
            let fallbackList = parsed.addedGames.map((item: any) =>
              typeof item === "string" ? { title: item } : item
            );
            if (q) {
              fallbackList = fallbackList.filter((item: any) =>
                item.title?.toLowerCase().includes(q)
              );
            }
            return NextResponse.json({
              success: true,
              run: {
                id: run.id,
                type: run.type,
                status: run.status,
                startedAt: run.startedAt,
                finishedAt: run.finishedAt,
                productsAdded: run.productsAdded,
                pricesChanged: run.pricesChanged,
              },
              counts: {
                total: parsed.addedGames.length,
                games: parsed.addedGames.length,
                dlcs: 0,
                bundles: 0,
              },
              items: fallbackList.slice(skip, skip + limit).map((g: any, idx: number) => ({
                id: `fallback-${idx}`,
                title: g.title,
                slug: g.slug || "",
                imageUrl: null,
                productClass: "BASE_GAME",
                currentPrice: g.price || 0,
                listPrice: g.price || 0,
                discountPercent: g.discount || 0,
                platforms: ["Xbox"],
              })),
              page,
              limit,
              totalItems: fallbackList.length,
              totalPages: Math.ceil(fallbackList.length / limit),
            });
          }
        } catch {
          // Ignore JSON parse error
        }
      }

      return NextResponse.json({
        success: true,
        run: {
          id: run.id,
          type: run.type,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          productsAdded: run.productsAdded,
          pricesChanged: run.pricesChanged,
        },
        counts: {
          total: totalAdded,
          games: gamesCount,
          dlcs: dlcsCount,
          bundles: bundlesCount,
        },
        items: games.map((g) => ({
          id: g.id,
          xboxProductId: g.xboxProductId,
          title: g.title,
          slug: g.slug,
          imageUrl: g.imageUrl,
          productClass: g.productClass,
          currentPrice: Number(g.currentPrice),
          listPrice: Number(g.listPrice),
          discountPercent: g.discountPercent,
          platforms: g.platforms,
          createdAt: g.createdAt,
        })),
        page,
        limit,
        totalItems: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      });
    }

    // Default: Updated prices in this run
    const basePriceHistoryWhere: any = {
      observedAt: {
        gte: windowStart,
        lte: windowEnd,
      },
      game: {
        firstSeenAt: {
          lt: windowStart,
        },
      },
    };

    const filterPriceHistoryWhere: any = { ...basePriceHistoryWhere };

    if (category === "games") {
      filterPriceHistoryWhere.game.productClass = ProductClass.BASE_GAME;
    } else if (category === "dlcs") {
      filterPriceHistoryWhere.game.productClass = { in: dlcClasses };
    } else if (category === "bundles") {
      filterPriceHistoryWhere.game.productClass = ProductClass.BUNDLE;
    }

    if (q) {
      filterPriceHistoryWhere.game.title = { contains: q, mode: "insensitive" };
    }

    const [filteredTotal, priceHistories] = await Promise.all([
      prisma.priceHistory.count({ where: filterPriceHistoryWhere }),
      prisma.priceHistory.findMany({
        where: filterPriceHistoryWhere,
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
            },
          },
        },
        orderBy: { observedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        type: run.type,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        productsAdded: run.productsAdded,
        pricesChanged: run.pricesChanged,
      },
      counts: {
        total: filteredTotal,
        games: 0,
        dlcs: 0,
        bundles: 0,
      },
      items: priceHistories
        .filter((ph) => Boolean(ph.game))
        .map((ph) => ({
          id: ph.id,
          xboxProductId: ph.game.xboxProductId,
          title: ph.game.title,
          slug: ph.game.slug,
          imageUrl: ph.game.imageUrl,
          productClass: ph.game.productClass,
          currentPrice: Number(ph.currentPrice),
          listPrice: Number(ph.listPrice),
          discountPercent: ph.discountPercent,
          platforms: ph.game.platforms,
          createdAt: ph.observedAt,
        })),
      page,
      limit,
      totalItems: filteredTotal,
      totalPages: Math.ceil(filteredTotal / limit),
    });
  } catch (err: any) {
    console.error("[SyncRunItems API Error]", err);
    return NextResponse.json(
      { error: "Detaylar yüklenemedi: " + err.message },
      { status: 500 }
    );
  }
}
