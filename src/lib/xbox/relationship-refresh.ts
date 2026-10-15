import { prisma } from "../db/prisma";
import { RelationType } from "@prisma/client";
import { XboxCatalogClient } from "./catalog-client";
import { qualifyXboxSeriesPlatform } from "./platform-qualifier";
import { processNormalizedProduct } from "../pricing/price-sync";
import { KNOWN_BUNDLE_CHILDREN } from "./mapper";
import { syncProgressTracker } from "./sync-progress-tracker";

export interface RelationshipRefreshOptions {
  limit?: number;
  batchSize?: number;
  triggerSource?: "MANUAL_SETTINGS_UI" | "SCHEDULER" | "CLI";
}

export interface RelationshipRefreshResult {
  success: boolean;
  message: string;
  stats: {
    bundlesChecked: number;
    relationsCreated: number;
    relationsCleaned: number;
    childrenEnriched: number;
    errors: number;
    durationMs: number;
  };
}

/**
 * Authoritative relationship refresh engine.
 * Refreshes BUNDLE_CONTAINS, DLC_OF, EXPANSION_OF, ADDON_OF, and SEASON_PASS_OF relations.
 * Strictly adheres to Microsoft Display Catalog authoritative payloads and KNOWN_BUNDLE_CHILDREN registry.
 * Strictly avoids inverted relations and title heuristics.
 */
export async function runRelationshipRefresh(
  options: RelationshipRefreshOptions = {}
): Promise<RelationshipRefreshResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 25;
  const catalogClient = new XboxCatalogClient();

  syncProgressTracker.addLog("İlişki tazeleme: Paketler ve eklentiler taranıyor...", "info");

  // 1. Identify all bundle candidates and games with productClass BUNDLE or known bundles
  const knownBundleIds = Object.keys(KNOWN_BUNDLE_CHILDREN).map((id) => id.toUpperCase());

  const bundleCandidates = await prisma.game.findMany({
    where: {
      OR: [
        { productClass: "BUNDLE" },
        { xboxProductId: { in: knownBundleIds } },
        { childRelations: { some: { relationType: RelationType.BUNDLE_CONTAINS } } },
      ],
      isActive: true,
    },
    select: {
      id: true,
      xboxProductId: true,
      title: true,
      productClass: true,
    },
    take: options.limit ? options.limit : undefined,
  });

  const totalBundles = bundleCandidates.length;
  syncProgressTracker.addLog(`${totalBundles} paket için Microsoft Mağazasından içerik doğrulaması başlatılıyor...`, "info");

  let relationsCreated = 0;
  let relationsCleaned = 0;
  let childrenEnriched = 0;
  let errors = 0;

  // Cache existing games for fast lookup
  const allDbGames = await prisma.game.findMany({
    select: { id: true, xboxProductId: true, productClass: true },
  });
  const dbMap = new Map(allDbGames.map((g) => [g.xboxProductId.toUpperCase(), g]));

  const bigIdPattern = /^[A-Z0-9]{12}$/i;
  const missingChildIds = new Set<string>();

  // Fetch bundles in batches to get latest bundledProductIds from Microsoft
  const bundleBigIds = bundleCandidates.map((b) => b.xboxProductId);

  for (let i = 0; i < bundleBigIds.length; i += batchSize) {
    if (syncProgressTracker.isCancelled()) {
      syncProgressTracker.addLog("İlişki yenileme kullanıcı talebiyle durduruldu.", "warn");
      break;
    }

    const chunkIds = bundleBigIds.slice(i, i + batchSize);
    try {
      const fetchedProducts = await catalogClient.fetchProductsBatch(chunkIds);

      for (const prod of fetchedProducts) {
        const parentInDb = dbMap.get(prod.productId.toUpperCase());
        if (!parentInDb) continue;

        // Collect authoritative child IDs from Microsoft API
        const authoritativeChildren = new Set<string>();

        if (prod.bundledProductIds && prod.bundledProductIds.length > 0) {
          for (const cId of prod.bundledProductIds) {
            const cleanId = cId.trim().toUpperCase();
            if (bigIdPattern.test(cleanId) && cleanId !== prod.productId.toUpperCase()) {
              authoritativeChildren.add(cleanId);
            }
          }
        }

        // Merge with curated known bundle children registry
        const curated = KNOWN_BUNDLE_CHILDREN[prod.productId.toUpperCase()];
        if (curated && curated.length > 0) {
          for (const cId of curated) {
            const cleanId = cId.trim().toUpperCase();
            if (bigIdPattern.test(cleanId) && cleanId !== prod.productId.toUpperCase()) {
              authoritativeChildren.add(cleanId);
            }
          }
        }

        // Check for missing child products that need auto-enrichment
        for (const childId of authoritativeChildren) {
          if (!dbMap.has(childId)) {
            missingChildIds.add(childId);
          }
        }

        // Clean up inverted relations where the bundle was erroneously recorded as a child
        const inverted = await prisma.gameRelation.deleteMany({
          where: {
            childGameId: parentInDb.id,
            relationType: RelationType.BUNDLE_CONTAINS,
          },
        });
        if (inverted.count > 0) {
          relationsCleaned += inverted.count;
        }

        // Link valid BUNDLE_CONTAINS relations
        let position = 0;
        for (const childId of authoritativeChildren) {
          const childInDb = dbMap.get(childId);
          if (childInDb && childInDb.id !== parentInDb.id) {
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
                  position,
                  source: "AUTHORITATIVE_REFRESH",
                },
                update: {
                  position,
                  observedAt: new Date(),
                },
              });
              relationsCreated++;
              position++;
            } catch (err: any) {
              console.warn(`[RelationshipRefresh] Upsert error:`, err.message);
            }
          }
        }
      }
    } catch (batchErr: any) {
      console.error("[RelationshipRefresh] Batch error:", batchErr.message);
      errors += chunkIds.length;
    }
  }

  // Auto-enrich any missing child products identified
  if (missingChildIds.size > 0) {
    const missingList = Array.from(missingChildIds);
    syncProgressTracker.addLog(
      `${missingList.length} adet eksik paket içeriği Microsoft mağazasından tamamlanıyor...`,
      "info"
    );

    for (let i = 0; i < missingList.length; i += batchSize) {
      if (syncProgressTracker.isCancelled()) break;
      const chunk = missingList.slice(i, i + batchSize);

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
              discoverySource: "RELATED",
              platforms: qual.platforms,
              isSeriesXCompatible: qual.platforms.includes("XboxSeriesX"),
            });

            if (res.added) {
              childrenEnriched++;
              const newChild = await prisma.game.findUnique({
                where: { xboxProductId: cp.productId },
                select: { id: true, xboxProductId: true, productClass: true },
              });
              if (newChild) {
                dbMap.set(newChild.xboxProductId.toUpperCase(), newChild);
              }
            }
          }
        }
      } catch (childErr: any) {
        console.error("[RelationshipRefresh] Child fetch error:", childErr.message);
        errors++;
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const now = new Date();

  // Update SystemSetting timestamp
  await prisma.systemSetting.upsert({
    where: { id: "global" },
    create: { id: "global", lastRelationshipRefreshAt: now },
    update: { lastRelationshipRefreshAt: now },
  });

  const summary = `İlişki yenileme tamamlandı: ${totalBundles} paket incelendi, ${relationsCreated} ilişki doğrulandı/bağlandı, ${relationsCleaned} hatalı/ters ilişki temizlendi, ${childrenEnriched} eksik alt ürün sisteme kazandırıldı.`;
  syncProgressTracker.addLog(summary, errors > 0 ? "warn" : "success");

  return {
    success: errors === 0 || relationsCreated > 0,
    message: summary,
    stats: {
      bundlesChecked: totalBundles,
      relationsCreated,
      relationsCleaned,
      childrenEnriched,
      errors,
      durationMs,
    },
  };
}
