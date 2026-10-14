import { prisma } from "../db/prisma";
import { SeriesDiscoveryProvider, DiscoveredProductSummary } from "./series-discovery-provider";
import { XboxCatalogClient } from "./catalog-client";
import { qualifyXboxSeriesPlatform } from "./platform-qualifier";
import { processNormalizedProduct } from "../pricing/price-sync";
import { RelationType } from "@prisma/client";
import { NormalizedXboxProduct } from "./types";

export interface BootstrapSeriesOptions {
  maxPages?: number;
  limitProducts?: number;
  batchSize?: number;
  onProgress?: (progress: BootstrapProgress) => void;
}

export interface BootstrapProgress {
  pagesFetched: number;
  totalCatalogItems: number;
  rawProductsDiscovered: number;
  productsEnriched: number;
  productsSaved: number;
  relationsCreated: number;
  rejectedPcOnly: number;
  rejectedXboxOneOnly: number;
  rejectedFree: number;
  rejectedOther: number;
  http429Count: number;
  http5xxCount: number;
}

export interface BootstrapQualityReport {
  timestamp: string;
  durationMs: number;
  totalRawDiscovered: number;
  totalSeriesXCompatible: number;
  rejectedPcOnly: number;
  rejectedXboxOneOnly: number;
  rejectedFree: number;
  rejectedOther: number;
  totalSaved: number;
  productClassCounts: Record<string, number>;
  totalRelationsCreated: number;
  totalMicrosoftRequests: number;
  avgBatchSize: number;
  http429Count: number;
  http5xxCount: number;
  sanityVerification: {
    blackMythWukongFound: boolean;
    blackMythWukongDetails?: {
      id: string;
      title: string;
      price: number;
      class: string;
      platforms: string[];
    } | null;
    sampleMajorGames: Array<{ id: string; title: string; class: string; price: number }>;
  };
}

export class FullCatalogBootstrap {
  private discoveryProvider: SeriesDiscoveryProvider;
  private catalogClient: XboxCatalogClient;

  constructor() {
    this.discoveryProvider = new SeriesDiscoveryProvider();
    this.catalogClient = new XboxCatalogClient();
  }

  /**
   * Executes the full catalog bootstrap pipeline:
   * Discovery -> Batch Display Catalog Enrichment -> Series Qualification -> DB Upsert -> Relationship Linking
   */
  public async execute(options: BootstrapSeriesOptions = {}): Promise<BootstrapQualityReport> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 25;
    const progress: BootstrapProgress = {
      pagesFetched: 0,
      totalCatalogItems: 0,
      rawProductsDiscovered: 0,
      productsEnriched: 0,
      productsSaved: 0,
      relationsCreated: 0,
      rejectedPcOnly: 0,
      rejectedXboxOneOnly: 0,
      rejectedFree: 0,
      rejectedOther: 0,
      http429Count: 0,
      http5xxCount: 0,
    };

    const discoveredIds = new Set<string>();
    const discoveredSummaryMap = new Map<string, DiscoveredProductSummary>();
    const pendingEnrichmentBatch: string[] = [];
    const enrichedProducts: NormalizedXboxProduct[] = [];
    const relatedIdsToEnrich = new Set<string>();

    console.log("[Bootstrap] Starting Xbox Series X|S Catalog Discovery...");

    // Helper to enrich a batch of Product IDs via Display Catalog V7
    const processBatch = async (ids: string[]) => {
      if (ids.length === 0) return;
      const batchStartTime = Date.now();
      const enrichedBatch = await this.catalogClient.fetchProductsBatch(ids);
      progress.productsEnriched += enrichedBatch.length;

      for (const p of enrichedBatch) {
        // Collect related IDs (bundle children or addon parent) for secondary linking
        if (p.bundledProductIds && p.bundledProductIds.length > 0) {
          for (const bid of p.bundledProductIds) {
            if (!discoveredIds.has(bid)) relatedIdsToEnrich.add(bid);
          }
        }
        if (p.parentProductId && !discoveredIds.has(p.parentProductId)) {
          relatedIdsToEnrich.add(p.parentProductId);
        }

        // Authoritative platform qualification
        const discSummary = discoveredSummaryMap.get(p.productId);
        const qual = qualifyXboxSeriesPlatform({
          productId: p.productId,
          availableOn: p.platforms.length > 0 ? p.platforms : discSummary?.availableOn,
          currentPrice: p.currentPrice,
          listPrice: p.listPrice,
          isFree: p.isFree,
          productType: p.productType,
        });

        if (!qual.isQualified) {
          if (qual.reason === "REJECTED_PC_ONLY") progress.rejectedPcOnly++;
          else if (qual.reason === "REJECTED_XBOX_ONE_ONLY") progress.rejectedXboxOneOnly++;
          else if (qual.reason === "REJECTED_FREE_PRODUCT") progress.rejectedFree++;
          else progress.rejectedOther++;
          continue;
        }

        // Ingest qualified product
        try {
          const res = await processNormalizedProduct(p, {
            discoverySource: "FULL_CATALOG",
            platforms: qual.platforms,
            isSeriesXCompatible: true,
            isCore: false,
          });
          if (res.added || !res.skipped) {
            progress.productsSaved++;
            enrichedProducts.push(p);
          }
        } catch (err: any) {
          console.error(`[Bootstrap] Error saving product ${p.productId}:`, err.message);
        }
      }

      if (options.onProgress) {
        options.onProgress(progress);
      }
    };

    // 1. Enumerate pages from Emerald Series X|S channel
    for await (const page of this.discoveryProvider.enumerateAll({ maxPages: options.maxPages })) {
      progress.pagesFetched++;
      progress.totalCatalogItems = page.totalCatalogItems;

      for (const prod of page.products) {
        if (!discoveredIds.has(prod.productId)) {
          discoveredIds.add(prod.productId);
          discoveredSummaryMap.set(prod.productId, prod);
          pendingEnrichmentBatch.push(prod.productId);
          progress.rawProductsDiscovered++;
        }

        if (options.limitProducts && progress.rawProductsDiscovered >= options.limitProducts) {
          break;
        }
      }

      // Flush batch when batch size is reached
      while (pendingEnrichmentBatch.length >= batchSize) {
        const chunk = pendingEnrichmentBatch.splice(0, batchSize);
        await processBatch(chunk);
      }

      if (options.limitProducts && progress.rawProductsDiscovered >= options.limitProducts) {
        console.log(`[Bootstrap] Reached product limit: ${options.limitProducts}`);
        break;
      }
    }

    // Flush any remaining items in the pending queue
    if (pendingEnrichmentBatch.length > 0) {
      await processBatch(pendingEnrichmentBatch.splice(0, pendingEnrichmentBatch.length));
    }

    console.log(`[Bootstrap] Primary enumeration done. Discovered: ${progress.rawProductsDiscovered}, Saved: ${progress.productsSaved}`);

    // 2. Enrich missing related products (bundle children or addon parents) if needed
    if (relatedIdsToEnrich.size > 0) {
      console.log(`[Bootstrap] Enriching ${relatedIdsToEnrich.size} verified related products (children/parents)...`);
      const relatedList = Array.from(relatedIdsToEnrich).slice(0, 100); // cap secondary enrich
      for (let i = 0; i < relatedList.length; i += batchSize) {
        const chunk = relatedList.slice(i, i + batchSize);
        try {
          const relatedBatch = await this.catalogClient.fetchProductsBatch(chunk);
          for (const rel of relatedBatch) {
            const qual = qualifyXboxSeriesPlatform({
              productId: rel.productId,
              availableOn: rel.platforms,
              currentPrice: rel.currentPrice,
              listPrice: rel.listPrice,
              isFree: rel.isFree,
              parentIsSeriesCompatible: true,
            });

            if (qual.isQualified) {
              await processNormalizedProduct(rel, {
                discoverySource: "RELATED",
                platforms: qual.platforms,
                isSeriesXCompatible: true,
              });
              enrichedProducts.push(rel);
            }
          }
        } catch (err: any) {
          console.warn(`[Bootstrap] Could not enrich related batch:`, err.message);
        }
      }
    }

    // 3. Link Game Relationships (Bundle contents & Add-on relations)
    console.log("[Bootstrap] Linking authoritative Game Relations...");
    const dbGames = await prisma.game.findMany({
      select: { id: true, xboxProductId: true, productClass: true },
    });
    const dbGameMap = new Map(dbGames.map((g) => [g.xboxProductId, g]));

    for (const p of enrichedProducts) {
      const parentInDb = dbGameMap.get(p.productId);
      if (!parentInDb) continue;

      // Bundle -> Child relations
      if (p.bundledProductIds && p.bundledProductIds.length > 0) {
        for (let i = 0; i < p.bundledProductIds.length; i++) {
          const childBigId = p.bundledProductIds[i];
          const childInDb = dbGameMap.get(childBigId);
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
              progress.relationsCreated++;
            } catch {
              // Ignore duplicate
            }
          }
        }
      }

      // Addon / DLC -> Parent Base Game relations
      if (p.parentProductId) {
        const baseGameInDb = dbGameMap.get(p.parentProductId);
        if (baseGameInDb) {
          let relType: RelationType = RelationType.ADDON_OF;
          if (p.productClass === "DLC") relType = RelationType.DLC_OF;
          else if (p.productClass === "EXPANSION") relType = RelationType.EXPANSION_OF;
          else if (p.productClass === "SEASON_PASS") relType = RelationType.SEASON_PASS_OF;

          try {
            await prisma.gameRelation.upsert({
              where: {
                parentGameId_childGameId_relationType: {
                  parentGameId: baseGameInDb.id,
                  childGameId: parentInDb.id,
                  relationType: relType,
                },
              },
              create: {
                parentGameId: baseGameInDb.id,
                childGameId: parentInDb.id,
                relationType: relType,
                source: "MICROSOFT_DISPLAY_CATALOG",
              },
              update: {},
            });
            progress.relationsCreated++;
          } catch {
            // Ignore duplicate
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const telemetry = this.discoveryProvider.getTelemetry();

    // 4. Query DB for final distribution
    const classDistribution = await prisma.game.groupBy({
      by: ["productClass"],
      _count: true,
    });
    const productClassCounts: Record<string, number> = {};
    for (const c of classDistribution) {
      productClassCounts[c.productClass] = c._count;
    }

    // 5. Sanity Verification: Check Black Myth: Wukong (9NWQ1Q1FR0C9)
    const wukong = await prisma.game.findUnique({
      where: { xboxProductId: "9NWQ1Q1FR0C9" },
      select: {
        xboxProductId: true,
        title: true,
        currentPrice: true,
        productClass: true,
        platforms: true,
      },
    });

    // Sample major verified titles
    const majorGames = await prisma.game.findMany({
      where: {
        xboxProductId: {
          in: ["9NWQ1Q1FR0C9", "9N6N6K5H99R6", "9NX7D15J774L", "9P4Z4T2GPN8L"],
        },
      },
      select: {
        xboxProductId: true,
        title: true,
        productClass: true,
        currentPrice: true,
      },
    });

    return {
      timestamp: new Date().toISOString(),
      durationMs,
      totalRawDiscovered: progress.rawProductsDiscovered,
      totalSeriesXCompatible: progress.productsSaved,
      rejectedPcOnly: progress.rejectedPcOnly,
      rejectedXboxOneOnly: progress.rejectedXboxOneOnly,
      rejectedFree: progress.rejectedFree,
      rejectedOther: progress.rejectedOther,
      totalSaved: progress.productsSaved,
      productClassCounts,
      totalRelationsCreated: progress.relationsCreated,
      totalMicrosoftRequests: telemetry.requestsCount + Math.ceil(progress.productsEnriched / batchSize),
      avgBatchSize: batchSize,
      http429Count: telemetry.http429Count,
      http5xxCount: telemetry.http5xxCount,
      sanityVerification: {
        blackMythWukongFound: Boolean(wukong),
        blackMythWukongDetails: wukong
          ? {
              id: wukong.xboxProductId,
              title: wukong.title,
              price: wukong.currentPrice.toNumber(),
              class: wukong.productClass,
              platforms: wukong.platforms,
            }
          : null,
        sampleMajorGames: majorGames.map((g) => ({
          id: g.xboxProductId,
          title: g.title,
          class: g.productClass,
          price: g.currentPrice.toNumber(),
        })),
      },
    };
  }
}
