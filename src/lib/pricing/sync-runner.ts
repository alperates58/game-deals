import { prisma } from "../db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../db/advisory-lock";
import { XboxCatalogClient } from "../xbox/catalog-client";
import { processNormalizedProduct } from "./price-sync";
import { syncProgressTracker } from "../xbox/sync-progress-tracker";

export interface SyncRunnerOptions {
  limit?: number;
  triggerSource?: string;
}

export interface SyncRunnerResult {
  success: boolean;
  message: string;
  locked?: boolean;
  stats?: {
    totalActive: number;
    checked: number;
    pricesChanged: number;
    errors: number;
    durationMs: number;
  };
}

/**
 * Executes a full or partial price synchronization run protected by PostgreSQL advisory lock.
 */
export async function runPriceSync(options: SyncRunnerOptions = {}): Promise<SyncRunnerResult> {
  const startTime = Date.now();
  const locked = await acquireAdvisoryLock();

  if (!locked) {
    return {
      success: false,
      locked: true,
      message: "Başka bir senkronizasyon işlemi zaten yürütülüyor. Advisory lock devrede.",
    };
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      type: "PRICE_SYNC",
      status: "RUNNING",
    },
  });

  try {
    const activeGames = await prisma.game.findMany({
      where: { isActive: true },
      select: { id: true, xboxProductId: true, title: true, franchise: true, isCore: true },
      take: options.limit ? options.limit : undefined,
    });

    const totalToSync = activeGames.length;
    const totalPages = Math.max(Math.ceil(totalToSync / 25), 1);
    syncProgressTracker.startSync("PRICE_SYNC", totalPages, totalToSync);
    syncProgressTracker.addLog(`${totalToSync} aktif oyun için güncel fiyat sorgusu başlatılıyor...`, "info");

    const client = new XboxCatalogClient();
    const productIds = activeGames.map((g) => g.xboxProductId);

    const products = await client.fetchAllInBatches(productIds);

    let changed = 0;
    let errors = 0;
    const gameMap = new Map(activeGames.map((g) => [g.xboxProductId, g]));

    let processedCount = 0;
    for (const product of products) {
      try {
        const game = gameMap.get(product.productId);
        const result = await processNormalizedProduct(
          product,
          game?.franchise || undefined,
          game?.isCore || false
        );
        if (result.priceChanged) {
          changed++;
          syncProgressTracker.addLog(
            `Fiyat değişimi: ${product.title || product.productId} (Yeni Fiyat: ${product.currentPrice.amount} ${product.currentPrice.currency})`,
            "info"
          );
        }
      } catch (err: any) {
        console.error(`[SyncRunner] Error updating game ${product.productId}:`, err.message);
        errors++;
      }

      processedCount++;
      if (processedCount % 25 === 0 || processedCount === products.length) {
        syncProgressTracker.updatePageProgress({
          page: Math.ceil(processedCount / 25),
          maxPages: totalPages,
          rawCount: processedCount,
          totalCatalogItems: totalToSync,
          addedCount: 0,
          updatedCount: changed,
          relationsCount: 0,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const now = new Date();

    // Summary sentence
    const summaryText = changed > 0
      ? `${products.length} oyun kontrol edildi. ${changed} oyunda fiyat / indirim değişimi tespit edildi.`
      : `${products.length} oyun kontrol edildi. Fiyat değişikliği tespit edilmedi (tüm fiyatlar güncel).`;

    // Update SystemSetting timestamp
    await prisma.systemSetting.upsert({
      where: { id: "global" },
      create: { id: "global", lastPriceSyncAt: now },
      update: { lastPriceSyncAt: now },
    });

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        finishedAt: now,
        productsFound: activeGames.length,
        productsChecked: products.length,
        pricesChanged: changed,
        errorCount: errors,
        errorSummary: errors > 0 ? `${errors} hata ile kısmen tamamlandı: ${summaryText}` : summaryText,
      },
    });

    syncProgressTracker.finishSync(summaryText, {
      productsAdded: 0,
      productsUpdated: changed,
      relationsCreated: 0,
    });

    return {
      success: true,
      message: `Fiyat senkronizasyonu tamamlandı. ${products.length} oyun kontrol edildi, ${changed} fiyat değişimi tespit edildi.`,
      stats: {
        totalActive: activeGames.length,
        checked: products.length,
        pricesChanged: changed,
        errors,
        durationMs,
      },
    };
  } catch (err: any) {
    console.error("[SyncRunner] Fatal error during sync:", err);
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
      message: `Senkronizasyon hatası: ${err.message}`,
    };
  } finally {
    await releaseAdvisoryLock();
  }
}
