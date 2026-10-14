import { prisma } from "../lib/db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../lib/db/advisory-lock";
import { XboxCatalogClient } from "../lib/xbox/catalog-client";
import { processNormalizedProduct } from "../lib/pricing/price-sync";
import { RelationType } from "@prisma/client";
import fs from "node:fs";

async function main() {
  console.log("=== XBOX PRODUCT CLASSIFICATION & RELATIONSHIPS START ===");
  const locked = await acquireAdvisoryLock();
  if (!locked) {
    console.warn("⚠️ Başka bir senkronizasyon işlemi zaten çalışıyor. İşlem sonlandırıldı.");
    process.exit(0);
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      type: "RECLASSIFICATION",
      status: "RUNNING",
    },
  });

  const catalogClient = new XboxCatalogClient();

  try {
    // 1. Fetch all products currently in DB
    const allGames = await prisma.game.findMany({
      select: { id: true, xboxProductId: true, title: true, productType: true },
    });

    console.log(`Found ${allGames.length} games in database to classify...`);
    const allBigIds = allGames.map((g) => g.xboxProductId);

    // 2. Fetch fresh catalog batch metadata with relations
    const products = await catalogClient.fetchAllInBatches(allBigIds, (proc, tot) => {
      console.log(`Metadata & Relations Progress: ${proc}/${tot}...`);
    });

    const dbGameMap = new Map(allGames.map((g) => [g.xboxProductId, g]));
    const classCounts: Record<string, number> = {};
    let relationsCreated = 0;
    let missingChildrenIds = new Set<string>();

    // 3. Update each game's productClass and rich metadata
    for (const p of products) {
      const existing = dbGameMap.get(p.productId);
      if (!existing) continue;

      classCounts[p.productClass] = (classCounts[p.productClass] || 0) + 1;

      await prisma.game.update({
        where: { id: existing.id },
        data: {
          productClass: p.productClass,
          developer: p.developer,
          shortDescription: p.shortDescription,
          longDescription: p.longDescription,
          releaseDate: p.releaseDate,
          genres: p.genres,
          capabilities: p.capabilities,
          screenshots: p.screenshots,
        },
      });

      // Track missing bundle children
      if (p.bundledProductIds && p.bundledProductIds.length > 0) {
        for (const childId of p.bundledProductIds) {
          if (!dbGameMap.has(childId)) {
            missingChildrenIds.add(childId);
          }
        }
      }

      // Track missing parent games
      if (p.parentProductId && !dbGameMap.has(p.parentProductId)) {
        missingChildrenIds.add(p.parentProductId);
      }
    }

    // 4. Ingest missing related bundle children / parent base games (RELATED tracking)
    if (missingChildrenIds.size > 0) {
      console.log(`Fetching ${missingChildrenIds.size} missing related products (bundle children / parents)...`);
      const relatedProducts = await catalogClient.fetchAllInBatches(Array.from(missingChildrenIds));
      for (const rel of relatedProducts) {
        try {
          const res = await processNormalizedProduct(rel, "İlişkili İçerik", false);
          if (res.added) {
            console.log(`+ Added related product: [${rel.productId}] ${rel.title} (${rel.productClass})`);
          }
        } catch (e: any) {
          console.warn(`Could not add related product ${rel.productId}:`, e.message);
        }
      }
    }

    // 5. Re-query all games to link GameRelation records
    const updatedGames = await prisma.game.findMany({
      select: { id: true, xboxProductId: true, title: true, productClass: true },
    });
    const updatedMap = new Map(updatedGames.map((g) => [g.xboxProductId, g]));

    for (const p of products) {
      const current = updatedMap.get(p.productId);
      if (!current) continue;

      // Handle Bundle -> Child relations
      if (p.bundledProductIds && p.bundledProductIds.length > 0) {
        for (let i = 0; i < p.bundledProductIds.length; i++) {
          const childBigId = p.bundledProductIds[i];
          const childGame = updatedMap.get(childBigId);
          if (childGame) {
            try {
              await prisma.gameRelation.upsert({
                where: {
                  parentGameId_childGameId_relationType: {
                    parentGameId: current.id,
                    childGameId: childGame.id,
                    relationType: RelationType.BUNDLE_CONTAINS,
                  },
                },
                create: {
                  parentGameId: current.id,
                  childGameId: childGame.id,
                  relationType: RelationType.BUNDLE_CONTAINS,
                  position: i,
                  source: "MICROSOFT_DISPLAY_CATALOG",
                },
                update: {
                  position: i,
                },
              });
              relationsCreated++;
            } catch (err) {
              // Ignore duplicate race
            }
          }
        }
      }

      // Handle Addon -> Base Game relations
      if (p.parentProductId) {
        const parentGame = updatedMap.get(p.parentProductId);
        if (parentGame) {
          let relType: RelationType = RelationType.ADDON_OF;
          if (p.productClass === "DLC") relType = RelationType.DLC_OF;
          else if (p.productClass === "EXPANSION") relType = RelationType.EXPANSION_OF;
          else if (p.productClass === "SEASON_PASS") relType = RelationType.SEASON_PASS_OF;

          try {
            await prisma.gameRelation.upsert({
              where: {
                parentGameId_childGameId_relationType: {
                  parentGameId: parentGame.id,
                  childGameId: current.id,
                  relationType: relType,
                },
              },
              create: {
                parentGameId: parentGame.id,
                childGameId: current.id,
                relationType: relType,
                source: "MICROSOFT_DISPLAY_CATALOG",
              },
              update: {},
            });
            relationsCreated++;
          } catch (err) {
            // Ignore duplicate
          }
        }
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      totalProductsChecked: products.length,
      classifications: classCounts,
      relationsCreated,
    };

    fs.mkdirSync("docs/evidence/faz1.1/addons", { recursive: true });
    fs.writeFileSync(
      "docs/evidence/faz1.1/addons/reclassification-summary.json",
      JSON.stringify(summary, null, 2)
    );

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        productsChecked: products.length,
        productsAdded: missingChildrenIds.size,
      },
    });

    console.log("=== XBOX PRODUCT CLASSIFICATION & RELATIONSHIPS COMPLETED ===");
    console.log("Classifications:", classCounts);
    console.log(`Total Game Relations Created: ${relationsCreated}`);
  } catch (err: any) {
    console.error("Fatal error during classification:", err);
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
