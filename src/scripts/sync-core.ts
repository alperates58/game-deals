import { prisma } from "../lib/db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../lib/db/advisory-lock";
import { XboxCatalogClient } from "../lib/xbox/catalog-client";
import { CORE_FRANCHISES } from "../data/core-franchises";
import { processNormalizedProduct } from "../lib/pricing/price-sync";

async function main() {
  console.log("=== XBOX CORE FRANCHISE SYNC START ===");
  const locked = await acquireAdvisoryLock();
  if (!locked) {
    console.warn("⚠️ Başka bir senkronizasyon işlemi zaten çalışıyor. İşlem sonlandırıldı.");
    process.exit(0);
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      type: "CORE_SYNC",
      status: "RUNNING",
    },
  });

  const client = new XboxCatalogClient();
  const allBigIdsToFetch: { id: string; franchise: string }[] = [];

  for (const franchise of CORE_FRANCHISES) {
    for (const id of franchise.sampleBigIds) {
      allBigIdsToFetch.push({ id, franchise: franchise.name });
    }
  }

  const uniqueIds = Array.from(new Set(allBigIdsToFetch.map((f) => f.id)));
  console.log(`Checking ${uniqueIds.length} candidate core game IDs...`);

  let added = 0;
  let changed = 0;
  let errors = 0;

  try {
    const products = await client.fetchAllInBatches(uniqueIds, (proc, tot) => {
      console.log(`Catalog Progress: ${proc}/${tot} products fetched...`);
    });

    console.log(`Received ${products.length} valid products from Display Catalog. Writing to database...`);

    const franchiseMap = new Map(allBigIdsToFetch.map((f) => [f.id.toUpperCase(), f.franchise]));

    for (const product of products) {
      try {
        const franchise = franchiseMap.get(product.productId) || "Diğer";
        const result = await processNormalizedProduct(product, franchise, true);
        if (result.added) added++;
        if (result.priceChanged) changed++;
      } catch (err: any) {
        console.error(`Error processing product ${product.productId}:`, err.message);
        errors++;
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        finishedAt: new Date(),
        productsFound: uniqueIds.length,
        productsChecked: products.length,
        productsAdded: added,
        pricesChanged: changed,
        errorCount: errors,
      },
    });

    console.log("=== XBOX CORE FRANCHISE SYNC COMPLETED ===");
    console.log(`Found: ${uniqueIds.length} | Added: ${added} | Price changes: ${changed} | Errors: ${errors}`);
  } catch (err: any) {
    console.error("Fatal error during sync:", err);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorCount: errors + 1,
        errorSummary: err.message,
      },
    });
  } finally {
    await releaseAdvisoryLock();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
