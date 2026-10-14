import { prisma } from "../lib/db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../lib/db/advisory-lock";
import { XboxCatalogClient } from "../lib/xbox/catalog-client";
import { processNormalizedProduct } from "../lib/pricing/price-sync";

async function main() {
  console.log("=== XBOX PRICE SYNC START ===");
  const locked = await acquireAdvisoryLock();
  if (!locked) {
    console.warn("⚠️ Başka bir senkronizasyon işlemi zaten çalışıyor. İşlem sonlandırıldı.");
    process.exit(0);
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
    });

    console.log(`Found ${activeGames.length} active games in database to check.`);
    const client = new XboxCatalogClient();
    const productIds = activeGames.map((g) => g.xboxProductId);

    const products = await client.fetchAllInBatches(productIds, (proc, tot) => {
      console.log(`Sync Progress: ${proc}/${tot} games checked...`);
    });

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
        console.error(`Error updating game ${product.productId}:`, err.message);
        errors++;
      }
    }

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

    console.log("=== XBOX PRICE SYNC COMPLETED ===");
    console.log(`Games checked: ${products.length} | Price changes detected: ${changed} | Errors: ${errors}`);
  } catch (err: any) {
    console.error("Fatal error during price sync:", err);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: err.message,
      },
    });
  } finally {
    await releaseAdvisoryLock();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
