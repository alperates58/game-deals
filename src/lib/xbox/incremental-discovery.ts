import { prisma } from "../db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../db/advisory-lock";
import { SeriesDiscoveryProvider } from "./series-discovery-provider";
import { XboxCatalogClient } from "./catalog-client";
import { qualifyXboxSeriesPlatform } from "./platform-qualifier";
import { processNormalizedProduct } from "../pricing/price-sync";
import { RelationType } from "@prisma/client";
import { NormalizedXboxProduct } from "./types";
import { KNOWN_BUNDLE_CHILDREN } from "./mapper";
import { syncProgressTracker } from "./sync-progress-tracker";

export interface IncrementalDiscoveryOptions {
  maxPages?: number; // default: 40 pages (~1,000 items)
  fullCrawl?: boolean; // if true, streams until catalog exhaustion (~120-150 pages)
  batchSize?: number; // default: 25
  triggerSource?: string; // "MANUAL_OWNER" | "SCHEDULER"
  skipLock?: boolean;
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
 * When fullCrawl is enabled, continuously streams all pages until store catalog exhaustion.
 */
export async function runIncrementalDiscovery(
  options: IncrementalDiscoveryOptions = {}
): Promise<IncrementalDiscoveryResult> {
  const startTime = Date.now();
  const isFullCrawl = Boolean(options.fullCrawl);
  const maxPages = isFullCrawl ? 250 : (options.maxPages || 40);
  const batchSize = options.batchSize || 25;

  let acquiredStandaloneLock = false;

  if (!options.skipLock) {
    const locked = await acquireAdvisoryLock();
    if (!locked) {
      return {
        success: false,
        locked: true,
        message: "Başka bir senkronizasyon veya tarama işlemi yürütülüyor. PostgreSQL advisory lock devrede.",
      };
    }
    acquiredStandaloneLock = true;
  }

  syncProgressTracker.startSync(
    isFullCrawl ? "FULL_CATALOG_CRAWL" : "CATALOG_DISCOVERY",
    isFullCrawl ? 140 : maxPages,
    isFullCrawl ? 3500 : maxPages * 25,
    isFullCrawl
  );

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
    const addedGames: { title: string; productId: string; currentPrice: number; discount: number }[] = [];
    const updatedGames: { title: string; productId: string; currentPrice: number; discount: number }[] = [];

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
            isSeriesXCompatible: qual.platforms.includes("XboxSeriesX"),
          });

          if (res.added) {
            productsAdded++;
            addedGames.push({
              title: prod.title,
              productId: prod.productId,
              currentPrice: prod.currentPrice,
              discount: prod.discountPercent,
            });
            syncProgressTracker.addLog(
              `Yeni oyun eklendi: "${prod.title}" (${prod.currentPrice} ${prod.currency})`,
              "info"
            );
          } else if (res.priceChanged || !res.skipped) {
            productsUpdated++;
            if (res.priceChanged) {
              updatedGames.push({
                title: prod.title,
                productId: prod.productId,
                currentPrice: prod.currentPrice,
                discount: prod.discountPercent,
              });
            }
          }

          enrichedList.push(prod);
        } catch (err: any) {
          console.error(`[IncrementalDiscovery] Error saving ${prod.productId}:`, err.message);
        }
      }
    };

    // Scan pages from Emerald (fullCrawl streams until catalog exhaustion)
    let dynamicMaxPages = maxPages;
    for await (const page of discoveryProvider.enumerateAll({ maxPages: isFullCrawl ? undefined : maxPages })) {
      if (syncProgressTracker.isCancelled()) {
        syncProgressTracker.addLog("Durdurma talebi uygulandı. Çekilen ürünler kaydedilerek işlem tamamlanıyor...", "warn");
        break;
      }

      pagesScanned++;
      if (isFullCrawl && page.totalCatalogItems) {
        dynamicMaxPages = Math.max(Math.ceil(page.totalCatalogItems / 25), pagesScanned);
      }

      for (const p of page.products) {
        if (!discoveredIds.has(p.productId)) {
          discoveredIds.add(p.productId);
          pendingBatch.push(p.productId);
          rawDiscovered++;
        }
      }

      while (pendingBatch.length >= batchSize) {
        if (syncProgressTracker.isCancelled()) break;
        const chunk = pendingBatch.splice(0, batchSize);
        await flushBatch(chunk);
      }

      // Live progress tracking update
      syncProgressTracker.updatePageProgress({
        page: pagesScanned,
        maxPages: dynamicMaxPages,
        rawCount: page.products.length,
        totalCatalogItems: page.totalCatalogItems,
        addedCount: productsAdded,
        updatedCount: productsUpdated,
        relationsCount: relationsCreated,
      });
    }

    if (pendingBatch.length > 0) {
      await flushBatch(pendingBatch.splice(0, pendingBatch.length));
    }

    // Link relationships for enriched items
    syncProgressTracker.addLog("Paket ve DLC ilişkileri tespit ediliyor ve veritabanına bağlanıyor...", "info");
    const dbGames = await prisma.game.findMany({
      select: { id: true, xboxProductId: true, productClass: true },
    });
    const dbMap = new Map(dbGames.map((g) => [g.xboxProductId, g]));

    // Auto-enrich any missing bundled child products from Microsoft Catalog
    const missingChildIds = new Set<string>();
    const bigIdPattern = /^[A-Z0-9]{12}$/i;
    for (const prod of enrichedList) {
      if (prod.bundledProductIds && prod.bundledProductIds.length > 0) {
        for (const childId of prod.bundledProductIds) {
          const cleanId = childId.trim().toUpperCase();
          if (bigIdPattern.test(cleanId) && !dbMap.has(cleanId)) {
            missingChildIds.add(cleanId);
          }
        }
      }
    }

    // Also verify any known curated bundle children in the registry
    for (const [bundleBigId, childIds] of Object.entries(KNOWN_BUNDLE_CHILDREN)) {
      if (dbMap.has(bundleBigId.toUpperCase())) {
        for (const childId of childIds) {
          const cleanId = childId.trim().toUpperCase();
          if (bigIdPattern.test(cleanId) && !dbMap.has(cleanId)) {
            missingChildIds.add(cleanId);
          }
        }
      }
    }

    if (missingChildIds.size > 0) {
      syncProgressTracker.addLog(
        `${missingChildIds.size} adet eksik paket içeriği (oyun/DLC) Microsoft mağazasından tamamlanıyor...`,
        "info"
      );
      const missingList = Array.from(missingChildIds);
      const childBatchSize = 25;
      for (let i = 0; i < missingList.length; i += childBatchSize) {
        if (syncProgressTracker.isCancelled()) {
          syncProgressTracker.addLog(
            "Paket içeriği tamamlama durduruldu. Mevcut veriler kaydedilerek işlem tamamlanıyor...",
            "warn"
          );
          break;
        }

        const chunk = missingList.slice(i, i + childBatchSize);
        try {
          const childProducts = await catalogClient.fetchProductsBatch(chunk);
          for (const cp of childProducts) {
            const qual = qualifyXboxSeriesPlatform({
              productId: cp.productId,
              availableOn: cp.platforms,
              currentPrice: cp.currentPrice,
              listPrice: cp.listPrice,
              isFree: cp.isFree,
              productType: cp.productType,
              parentIsSeriesCompatible: true,
            });

            if (qual.isQualified) {
              const res = await processNormalizedProduct(cp, {
                discoverySource: "BUNDLE_CHILD",
                platforms: qual.platforms,
                isSeriesXCompatible: qual.platforms.includes("XboxSeriesX"),
              });

              if (res.added) {
                productsAdded++;
                addedGames.push({
                  title: cp.title,
                  productId: cp.productId,
                  currentPrice: cp.currentPrice,
                  discount: cp.discountPercent,
                });
              }

              const newChild = await prisma.game.findUnique({
                where: { xboxProductId: cp.productId },
                select: { id: true, xboxProductId: true, productClass: true },
              });
              if (newChild) {
                dbMap.set(newChild.xboxProductId, newChild);
              }
            }
          }
        } catch (err: any) {
          console.error(`[IncrementalDiscovery] Error auto-enriching bundle children:`, err.message);
        }

        const processedCount = Math.min(i + chunk.length, missingList.length);
        const percentComplete = Math.round((processedCount / missingList.length) * 100);

        syncProgressTracker.updatePageProgress({
          page: pagesScanned,
          maxPages: dynamicMaxPages,
          rawCount: 0,
          addedCount: productsAdded,
          updatedCount: productsUpdated,
          relationsCount: relationsCreated,
        });

        if (i % 100 === 0 || processedCount === missingList.length) {
          syncProgressTracker.addLog(
            `Paket içerikleri taranıyor: ${processedCount}/${missingList.length} (%${percentComplete}) - Toplam yeni: ${productsAdded}`,
            "info"
          );
        }
      }
    }

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

    // Link relations for any known curated bundles
    for (const [bundleBigId, childIds] of Object.entries(KNOWN_BUNDLE_CHILDREN)) {
      const parentInDb = dbMap.get(bundleBigId.toUpperCase());
      if (parentInDb) {
        for (let i = 0; i < childIds.length; i++) {
          const childBigId = childIds[i].toUpperCase();
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
                  position: 10 + i,
                  source: "KNOWN_REGISTRY",
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

    const isCancelled = syncProgressTracker.isCancelled();
    const summaryPrefix = isCancelled ? "Kullanıcı talebiyle durduruldu: " : isFullCrawl ? "Tam mağaza taraması: " : "";
    const summaryText = productsAdded > 0
      ? `${summaryPrefix}${pagesScanned} sayfa tarandı (${rawDiscovered} ürün). +${productsAdded} yeni oyun eklendi, ${productsUpdated} oyun güncellendi.`
      : `${summaryPrefix}${pagesScanned} sayfa tarandı (${rawDiscovered} ürün). Yeni oyun eklenmedi, ${productsUpdated} oyun güncellendi.`;

    const summaryPayload = JSON.stringify({
      text: summaryText,
      addedGames: addedGames.slice(0, 100).map((g) => ({
        title: g.title,
        price: g.currentPrice,
        discount: g.discount,
      })),
      updatedGames: updatedGames.slice(0, 50).map((g) => ({
        title: g.title,
        price: g.currentPrice,
        discount: g.discount,
      })),
    });

    // Update SyncRun
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: isCancelled ? "PARTIAL" : "COMPLETED",
        finishedAt: now,
        productsFound: rawDiscovered,
        productsChecked: rawDiscovered,
        productsAdded,
        pricesChanged: productsUpdated,
        errorSummary: summaryPayload,
      },
    });

    syncProgressTracker.finishSync(summaryText, { productsAdded, productsUpdated, relationsCreated });

    return {
      success: true,
      message: summaryText,
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
    syncProgressTracker.failSync(err.message);

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
    if (acquiredStandaloneLock) {
      await releaseAdvisoryLock();
    }
  }
}
