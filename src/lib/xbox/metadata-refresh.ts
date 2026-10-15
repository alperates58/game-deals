import { prisma } from "../db/prisma";
import { XboxCatalogClient } from "./catalog-client";
import { processNormalizedProduct } from "../pricing/price-sync";
import { syncProgressTracker } from "./sync-progress-tracker";

export interface MetadataRefreshOptions {
  limit?: number;
  batchSize?: number;
  triggerSource?: "MANUAL_SETTINGS_UI" | "SCHEDULER" | "CLI";
}

export interface MetadataRefreshResult {
  success: boolean;
  message: string;
  stats: {
    totalTargeted: number;
    processed: number;
    metadataUpdated: number;
    pricesChanged: number;
    errors: number;
    durationMs: number;
  };
}

/**
 * Executes authoritative catalog metadata refresh.
 * Updates titles, publishers, developers, release dates, descriptions, genres, capabilities, screenshots, and platforms.
 * Preserves price history integrity: does NOT create price history unless an authoritative price change is detected.
 */
export async function runMetadataRefresh(options: MetadataRefreshOptions = {}): Promise<MetadataRefreshResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 25;

  // Retrieve active games, prioritizing oldest updated records
  const targetGames = await prisma.game.findMany({
    where: { isActive: true },
    select: {
      id: true,
      xboxProductId: true,
      title: true,
      publisher: true,
      developer: true,
      releaseDate: true,
      shortDescription: true,
      longDescription: true,
      genres: true,
      capabilities: true,
      screenshots: true,
      imageUrl: true,
      platforms: true,
      isSeriesXCompatible: true,
      currentPrice: true,
      listPrice: true,
      franchise: true,
      isCore: true,
    },
    orderBy: { updatedAt: "asc" },
    take: options.limit ? options.limit : undefined,
  });

  const total = targetGames.length;
  const totalPages = Math.max(Math.ceil(total / batchSize), 1);
  syncProgressTracker.addLog(`${total} oyun için Microsoft Mağazasından metadata tazeleme başlatılıyor...`, "info");

  const catalogClient = new XboxCatalogClient();
  const gameMap = new Map(targetGames.map((g) => [g.xboxProductId, g]));
  const productIds = targetGames.map((g) => g.xboxProductId);

  let processed = 0;
  let metadataUpdated = 0;
  let pricesChanged = 0;
  let errors = 0;

  for (let i = 0; i < productIds.length; i += batchSize) {
    if (syncProgressTracker.isCancelled()) {
      syncProgressTracker.addLog("Metadata yenileme kullanıcı talebiyle durduruldu. Mevcut veriler kaydedildi.", "warn");
      break;
    }

    const chunkIds = productIds.slice(i, i + batchSize);
    try {
      const batchProducts = await catalogClient.fetchProductsBatch(chunkIds);

      for (const prod of batchProducts) {
        const existing = gameMap.get(prod.productId);
        if (!existing) continue;

        try {
          const existingCurrent = existing.currentPrice.toNumber();
          const existingList = existing.listPrice.toNumber();
          const priceActuallyChanged =
            prod.currentPrice > 0 &&
            (existingCurrent !== prod.currentPrice || existingList !== prod.listPrice);

          if (priceActuallyChanged) {
            // Price changed authoritatively: use existing pricing pipeline
            const res = await processNormalizedProduct(
              prod,
              existing.franchise || undefined,
              existing.isCore
            );
            if (res.priceChanged) {
              pricesChanged++;
            }
          }

          // Authoritative metadata update
          await prisma.game.update({
            where: { id: existing.id },
            data: {
              title: prod.title || existing.title,
              normalizedTitle: prod.normalizedTitle || existing.title.toLowerCase(),
              publisher: prod.publisher || existing.publisher,
              developer: prod.developer || existing.developer,
              releaseDate: prod.releaseDate || existing.releaseDate,
              shortDescription: prod.shortDescription || existing.shortDescription,
              longDescription: prod.longDescription || existing.longDescription,
              genres: prod.genres && prod.genres.length > 0 ? prod.genres : existing.genres,
              capabilities: prod.capabilities && prod.capabilities.length > 0 ? prod.capabilities : existing.capabilities,
              screenshots: prod.screenshots && prod.screenshots.length > 0 ? prod.screenshots : existing.screenshots,
              imageUrl: prod.imageUrl || existing.imageUrl,
              platforms: prod.platforms && prod.platforms.length > 0 ? prod.platforms : existing.platforms,
              isSeriesXCompatible: prod.platforms?.includes("XboxSeriesX") ?? existing.isSeriesXCompatible,
              productClass: prod.productClass !== "UNKNOWN" ? prod.productClass : undefined,
              lastSeenAt: new Date(),
            },
          });

          metadataUpdated++;
        } catch (itemErr: any) {
          console.error(`[MetadataRefresh] Error updating game ${prod.productId}:`, itemErr.message);
          errors++;
        }

        processed++;
      }
    } catch (batchErr: any) {
      console.error(`[MetadataRefresh] Batch error:`, batchErr.message);
      errors += chunkIds.length;
      processed += chunkIds.length;
    }

    const currentPage = Math.floor(i / batchSize) + 1;
    if (currentPage % 10 === 0 || processed >= total) {
      syncProgressTracker.addLog(
        `Metadata ilerleme: ${processed}/${total} tamamlandı (%${Math.round((processed / Math.max(total, 1)) * 100)})`,
        "info"
      );
    }
  }

  const durationMs = Date.now() - startTime;
  const now = new Date();

  // Update SystemSetting timestamp
  await prisma.systemSetting.upsert({
    where: { id: "global" },
    create: { id: "global", lastMetadataRefreshAt: now },
    update: { lastMetadataRefreshAt: now },
  });

  const summary = `Metadata yenileme tamamlandı: ${processed} oyun işlendi, ${metadataUpdated} metadata güncellendi, ${pricesChanged} fiyat değişimi tespit edildi.`;
  syncProgressTracker.addLog(summary, errors > 0 ? "warn" : "success");

  return {
    success: errors === 0 || metadataUpdated > 0,
    message: summary,
    stats: {
      totalTargeted: total,
      processed,
      metadataUpdated,
      pricesChanged,
      errors,
      durationMs,
    },
  };
}
