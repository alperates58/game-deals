import { prisma } from "../db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../db/advisory-lock";
import { XboxCatalogClient } from "../xbox/catalog-client";
import { processNormalizedProduct } from "./price-sync";

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
      select: { id: true, xboxProductId: true, franchise: true, isCore: true },
      take: options.limit ? options.limit : undefined,
    });

    const client = new XboxCatalogClient();
    const productIds = activeGames.map((g) => g.xboxProductId);

    const products = await client.fetchAllInBatches(productIds);

    let changed = 0;
    let errors = 0;
    const gameMap = new Map(activeGames.map((g) => [g.xboxProductId, g]));

    for (const product of products) {
      try {
        const game = gameMap.get(product.productId);
        const result = await processNormalizedProduct(
          product,
          game?.franchise || undefined,
          game?.isCore || false
        );
        if (result.priceChanged) changed++;
      } catch (err: any) {
        console.error(`[SyncRunner] Error updating game ${product.productId}:`, err.message);
        errors++;
      }
    }

    const durationMs = Date.now() - startTime;

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        finishedAt: new Date(),
        productsFound: activeGames.length,
        productsChecked: products.length,
        pricesChanged: changed,
        errorCount: errors,
      },
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
