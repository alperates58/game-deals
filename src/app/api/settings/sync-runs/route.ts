import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";

export interface EnrichedGameItem {
  title: string;
  slug?: string;
  price?: number;
  discount?: number;
  productClass?: string;
}

export async function GET(req: Request) {
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
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);

    const rawSyncRuns = await prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    const enrichedSyncRuns = await Promise.all(
      rawSyncRuns.map(async (run) => {
        let summaryText: string = run.errorSummary || "";
        let addedGames: EnrichedGameItem[] = [];
        let updatedGames: EnrichedGameItem[] = [];

        // Try parsing JSON summary if present
        if (run.errorSummary && run.errorSummary.startsWith("{")) {
          try {
            const parsed = JSON.parse(run.errorSummary);
            if (parsed.text) summaryText = parsed.text;
            if (Array.isArray(parsed.addedGames)) {
              addedGames = parsed.addedGames.map((item: any) =>
                typeof item === "string" ? { title: item } : item
              );
            }
            if (Array.isArray(parsed.updatedGames)) {
              updatedGames = parsed.updatedGames.map((item: any) =>
                typeof item === "string" ? { title: item } : item
              );
            }
          } catch {
            // Keep original summaryText
          }
        }

        // If run added products but no addedGames list was parsed (e.g. historical run),
        // look up games created during that run's timeframe
        if (run.productsAdded > 0 && addedGames.length === 0) {
          try {
            const windowStart = new Date(run.startedAt.getTime() - 5000);
            const windowEnd = run.finishedAt
              ? new Date(run.finishedAt.getTime() + 5000)
              : new Date();

            const dbAddedGames = await prisma.game.findMany({
              where: {
                createdAt: {
                  gte: windowStart,
                  lte: windowEnd,
                },
              },
              select: {
                title: true,
                slug: true,
                currentPrice: true,
                discountPercent: true,
                productClass: true,
              },
              take: 50,
            });

            if (dbAddedGames.length > 0) {
              addedGames = dbAddedGames.map((g) => ({
                title: g.title,
                slug: g.slug,
                price: Number(g.currentPrice),
                discount: g.discountPercent,
                productClass: g.productClass,
              }));
            }
          } catch (queryErr) {
            console.error("Failed to query historical added games:", queryErr);
          }
        }

        // If run changed prices but no updatedGames list was parsed,
        // look up price histories recorded during that run's timeframe
        if (run.pricesChanged > 0 && updatedGames.length === 0) {
          try {
            const windowStart = new Date(run.startedAt.getTime() - 2000);
            const windowEnd = run.finishedAt
              ? new Date(run.finishedAt.getTime() + 2000)
              : new Date(run.startedAt.getTime() + 10 * 60 * 1000);

            const dbPriceHistories = await prisma.priceHistory.findMany({
              where: {
                observedAt: {
                  gte: windowStart,
                  lte: windowEnd,
                },
                game: {
                  firstSeenAt: {
                    lt: windowStart,
                  },
                },
              },
              include: {
                game: {
                  select: {
                    title: true,
                    slug: true,
                  },
                },
              },
              take: 50,
            });

            if (dbPriceHistories.length > 0) {
              const seenSlugs = new Set<string>();
              updatedGames = [];
              for (const ph of dbPriceHistories) {
                if (ph.game && !seenSlugs.has(ph.game.slug)) {
                  seenSlugs.add(ph.game.slug);
                  updatedGames.push({
                    title: ph.game.title,
                    slug: ph.game.slug,
                    price: Number(ph.currentPrice),
                    discount: ph.discountPercent,
                  });
                }
              }
            }
          } catch (queryErr) {
            console.error("Failed to query historical updated games:", queryErr);
          }
        }

        // Generate fallback text if empty
        if (!summaryText) {
          if (run.productsAdded > 0) {
            summaryText = `${run.productsChecked || run.productsFound} ürün kontrol edildi. +${run.productsAdded} yeni oyun eklendi.`;
          } else if (run.pricesChanged > 0) {
            summaryText = `${run.productsChecked || run.productsFound} ürün kontrol edildi. ${run.pricesChanged} fiyat güncellendi.`;
          } else if (run.status === "COMPLETED") {
            summaryText = `${run.productsChecked || run.productsFound} ürün kontrol edildi. Değişiklik yok (güncel).`;
          } else {
            summaryText = `İşlem durumu: ${run.status}`;
          }
        }

        return {
          id: run.id,
          type: run.type,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          productsFound: run.productsFound,
          productsChecked: run.productsChecked,
          productsAdded: run.productsAdded,
          pricesChanged: run.pricesChanged,
          errorCount: run.errorCount,
          summaryText,
          addedGames,
          updatedGames,
        };
      })
    );

    return NextResponse.json({
      success: true,
      syncRuns: enrichedSyncRuns,
    });
  } catch (err: any) {
    console.error("[SyncRuns API Error]", err);
    return NextResponse.json(
      { error: "Tarama geçmişi yüklenemedi: " + err.message },
      { status: 500 }
    );
  }
}
