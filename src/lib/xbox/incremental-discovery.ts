import { prisma } from "../db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../db/advisory-lock";
import { SeriesDiscoveryProvider } from "./series-discovery-provider";
import { XboxCatalogClient } from "./catalog-client";
import { qualifyXboxSeriesPlatform } from "./platform-qualifier";
import { processNormalizedProduct } from "../pricing/price-sync";
import { RelationType } from "@prisma/client";
import { NormalizedXboxProduct } from "./types";

export interface IncrementalDiscoveryOptions {
  maxPages?: number; // default: 5 pages (125 items)
  batchSize?: number; // default: 25
  triggerSource?: string; // "MANUAL_OWNER" | "SCHEDULER"
}

export interface IncrementalDiscoveryResult {
  success: boolean;
  message: string;
  locked?: boolean;
  stats?: {
    pagesScanned: number;
    rawDiscovered: number;
    productsAdded: number;
    productsUpdated: number;
    relationsCreated: number;
    rejectedFree: number;
    rejectedPcOnly: number;
    durationMs: number;
  };
}

/**
 * Runs incremental Xbox Series X|S catalog discovery under advisory lock.
 * Scans recent browse stream pages for newly added titles, back-catalog releases, and bundles/DLCs.
 */
export async function runIncrementalDiscovery(
  options: IncrementalDiscoveryOptions = {}
): Promise<IncrementalDiscoveryResult> {
  const startTime = Date.now();
  const maxPages = options.maxPages || 5;
  const batchSize = options.batchSize || 25;

  const locked = await acquireAdvisoryLock();
  if (!locked) {
    return {
      success: false,
      locked: true,
      message: "Başka bir senkronizasyon veya tarama işlemi yürütülüyor. PostgreSQL advisory lock devrede.",
    };
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      type: "DISCOVERY",
      status: "RUNNING",
    },
  });

  try {
    const discoveryProvider = new SeriesDiscoveryProvider();
    const catalogClient = new XboxCatalogClient();

    let pagesScanned = 0;
    let rawDiscovered = 0;
    let productsAdded = 0;
    let productsUpdated = 0;
    let relationsCreated = 0;
    let rejectedFree = 0;
    let rejectedPcOnly = 0;

    const discoveredIds = new Set<string>();
    const pendingBatch: string[] = [];
    const enrichedList: NormalizedXboxProduct[] = [];

    // Helper to process and upsert a batch
    const flushBatch = async (ids: string[]) => {
      if (ids.length === 0) return;
      const batchEnriched = await catalogClient.fetchProductsBatch(ids);

      for (const prod of batchEnriched) {
        const qual = qualifyXboxSeriesPlatform({
          productId: prod.productId,
          availableOn: prod.platforms,
          currentPrice: prod.currentPrice,
          listPrice: prod.listPrice,
          isFree: prod.isFree,
          productType: prod.productType,
        });

        if (!qual.isQualified) {
          if (qual.reason === "REJECTED_FREE_PRODUCT") rejectedFree++;
          else if (qual.reason === "REJECTED_PC_ONLY") rejectedPcOnly++;
          continue;
        }

        try {
          const res = await processNormalizedProduct(prod, {
            discoverySource: "FULL_CATALOG",
            platforms: qual.platforms,
            isSeriesXCompatible: true,
          });

          if (res.added) productsAdded++;
          else if (res.priceChanged || !res.skipped) productsUpdated++;

          enrichedList.push(prod);
        } catch (err: any) {
          console.error(`[IncrementalDiscovery] Error saving ${prod.productId}:`, err.message);
        }
      }
    };

    // Scan recent pages from Emerald
    for await (const page of discoveryProvider.enumerateAll({ maxPages })) {
      pagesScanned++;
      for (const p of page.products) {
        if (!discoveredIds.has(p.productId)) {
          discoveredIds.add(p.productId);
          pendingBatch.push(p.productId);
          rawDiscovered++;
        }
      }

      while (pendingBatch.length >= batchSize) {
        const chunk = pendingBatch.splice(0, batchSize);
        await flushBatch(chunk);
      }
    }

    if (pendingBatch.length > 0) {
      await flushBatch(pendingBatch.splice(0, pendingBatch.length));
    }

    // Link relationships for enriched items
    const dbGames = await prisma.game.findMany({
      select: { id: true, xboxProductId: true, productClass: true },
    });
    const dbMap = new Map(dbGames.map((g) => [g.xboxProductId, g]));

    for (const prod of enrichedList) {
      const parentInDb = dbMap.get(prod.productId);
      if (!parentInDb) continue;

      if (prod.bundledProductIds && prod.bundledProductIds.length > 0) {
        for (let i = 0; i < prod.bundledProductIds.length; i++) {
          const childBigId = prod.bundledProductIds[i];
          const childInDb = dbMap.get(childBigId);
          if (childInDb) {
            try {
              await prisma.gameRelation.upsert({
                where: {
                  parentGameId_childGameId_relationType: {
                    parentGameId: parentInDb.id,
                    childGameId: childInDb.id,
                    relationType: RelationType.BUNDLE_CONTAINS,
                  },
                },
                create: {
                  parentGameId: parentInDb.id,
                  childGameId: childInDb.id,
                  relationType: RelationType.BUNDLE_CONTAINS,
                  position: i,
                  source: "MICROSOFT_DISPLAY_CATALOG",
                },
                update: { position: i },
              });
              relationsCreated++;
            } catch {
              // Ignore duplicate
            }
          }
        }
      }

      if (prod.parentProductId) {
        const baseInDb = dbMap.get(prod.parentProductId);
        if (baseInDb) {
          let relType: RelationType = RelationType.ADDON_OF;
          if (prod.productClass === "DLC") relType = RelationType.DLC_OF;
          else if (prod.productClass === "EXPANSION") relType = RelationType.EXPANSION_OF;
          else if (prod.productClass === "SEASON_PASS") relType = RelationType.SEASON_PASS_OF;

          try {
            await prisma.gameRelation.upsert({
              where: {
                parentGameId_childGameId_relationType: {
                  parentGameId: baseInDb.id,
                  childGameId: parentInDb.id,
                  relationType: relType,
                },
              },
              create: {
                parentGameId: baseInDb.id,
                childGameId: parentInDb.id,
                relationType: relType,
                source: "MICROSOFT_DISPLAY_CATALOG",
              },
              update: {},
            });
            relationsCreated++;
          } catch {
            // Ignore duplicate
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const now = new Date();

    // Update SystemSetting timestamp
    await prisma.systemSetting.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        lastCatalogDiscoveryAt: now,
      },
      update: {
        lastCatalogDiscoveryAt: now,
      },
    });

    // Update SyncRun
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: now,
        productsFound: rawDiscovered,
        productsChecked: rawDiscovered,
        productsAdded,
      },
    });

    return {
      success: true,
      message: `Artımlı katalog taraması tamamlandı. ${pagesScanned} sayfa tarandı, ${productsAdded} yeni oyun eklendi, ${productsUpdated} oyun güncellendi.`,
      stats: {
        pagesScanned,
        rawDiscovered,
        productsAdded,
        productsUpdated,
        relationsCreated,
        rejectedFree,
        rejectedPcOnly,
        durationMs,
      },
    };
  } catch (err: any) {
    console.error("[IncrementalDiscovery] Fatal error:", err);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: err.message,
      },
    });

    return {
      success: false,
      message: `Katalog tarama hatası: ${err.message}`,
    };
  } finally {
    await releaseAdvisoryLock();
  }
}
