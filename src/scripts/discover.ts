import { prisma } from "../lib/db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../lib/db/advisory-lock";
import { XboxDiscoveryClient } from "../lib/xbox/discovery-client";
import { XboxCatalogClient } from "../lib/xbox/catalog-client";
import { processNormalizedProduct } from "../lib/pricing/price-sync";
import { CORE_FRANCHISES } from "../data/core-franchises";

async function main() {
  console.log("=== XBOX GAME DISCOVERY START ===");
  const locked = await acquireAdvisoryLock();
  if (!locked) {
    console.warn("⚠️ Başka bir senkronizasyon işlemi zaten çalışıyor. İşlem sonlandırıldı.");
    process.exit(0);
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      type: "DISCOVERY",
      status: "RUNNING",
    },
  });

  const discoveryClient = new XboxDiscoveryClient();
  const catalogClient = new XboxCatalogClient();

  const discoveredIds = new Set<string>();
  const franchiseMap = new Map<string, string>();

  // Search each core franchise query
  for (const franchise of CORE_FRANCHISES) {
    console.log(`Searching store for franchise: ${franchise.name}...`);
    try {
      const ids = await discoveryClient.searchStoreForProductIds(franchise.query);
      for (const id of ids) {
        discoveredIds.add(id);
        if (!franchiseMap.has(id)) {
          franchiseMap.set(id, franchise.name);
        }
      }
    } catch (err: any) {
      console.warn(`Search failed for ${franchise.name}:`, err.message);
    }
  }

  // Also search for general top deals keywords
  const genericQueries = ["Xbox Series X|S", "Oyunlar", "İndirimler"];
  for (const q of genericQueries) {
    try {
      const ids = await discoveryClient.searchStoreForProductIds(q);
      ids.forEach((id) => discoveredIds.add(id));
    } catch (err: any) {
      console.warn(`Search failed for query "${q}":`, err.message);
    }
  }

  const allIds = Array.from(discoveredIds);
  console.log(`Discovered ${allIds.length} candidate product IDs. Querying Display Catalog...`);

  let added = 0;
  let errors = 0;

  try {
    const products = await catalogClient.fetchAllInBatches(allIds, (proc, tot) => {
      console.log(`Discovery Catalog Progress: ${proc}/${tot} games resolved...`);
    });

    for (const product of products) {
      try {
        const franchise = franchiseMap.get(product.productId) || "Popüler";
        const result = await processNormalizedProduct(product, franchise, false);
        if (result.added) added++;
      } catch (err: any) {
        console.error(`Error processing discovered product ${product.productId}:`, err.message);
        errors++;
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        finishedAt: new Date(),
        productsFound: allIds.length,
        productsChecked: products.length,
        productsAdded: added,
        errorCount: errors,
      },
    });

    console.log("=== XBOX GAME DISCOVERY COMPLETED ===");
    console.log(`Found IDs: ${allIds.length} | Added to catalog: ${added} | Errors: ${errors}`);
  } catch (err: any) {
    console.error("Fatal discovery error:", err);
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
