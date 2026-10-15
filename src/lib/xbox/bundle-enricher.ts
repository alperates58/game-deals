import { prisma } from "../db/prisma";
import { RelationType } from "@prisma/client";
import { XboxCatalogClient, catalogClient } from "./catalog-client";
import { KNOWN_BUNDLE_CHILDREN } from "./mapper";
import { qualifyXboxSeriesPlatform } from "./platform-qualifier";
import { processNormalizedProduct } from "../pricing/price-sync";
import { NormalizedXboxProduct } from "./types";

export const BUNDLE_RELATION_SOURCE_V2 = "DISPLAY_CATALOG_V2";

export interface BundleEnrichResult {
  updated: boolean;
  childCount: number;
}

/**
 * Fetches authoritative BundledSkus for a bundle from Microsoft Display Catalog,
 * resolves commercial wrapper prices for 0 TL leaf game SKUs (when S(W) is a strict subset of S(B)),
 * upserts all child games/DLCs in PostgreSQL, and links BUNDLE_CONTAINS relations.
 */
export async function enrichBundleChildrenFromCatalog(
  bundleGameId: string,
  bundleBigId: string
): Promise<BundleEnrichResult> {
  const cleanBundleBigId = (bundleBigId || "").trim().toUpperCase();
  if (!cleanBundleBigId || cleanBundleBigId.length !== 12) {
    return { updated: false, childCount: 0 };
  }

  const client = catalogClient || new XboxCatalogClient();
  const [freshBundle] = await client.fetchProductsBatch([cleanBundleBigId]);

  const knownKids = KNOWN_BUNDLE_CHILDREN[cleanBundleBigId] || [];
  const rawCandidateIds = [
    ...(freshBundle?.bundledProductIds || []),
    ...knownKids,
  ];

  const allChildBigIds = Array.from(
    new Set(
      rawCandidateIds
        .map((id) => id.trim().toUpperCase())
        .filter((id) => /^[A-Z0-9]{12}$/.test(id) && id !== cleanBundleBigId)
    )
  );

  if (allChildBigIds.length === 0) {
    return { updated: false, childCount: 0 };
  }

  const allChildSet = new Set(allChildBigIds);

  // Fetch all child products from Microsoft Display Catalog
  const fetchedChildren = await client.fetchProductsBatch(allChildBigIds);
  const fetchedMap = new Map<string, NormalizedXboxProduct>();
  for (const cp of fetchedChildren) {
    fetchedMap.set(cp.productId.toUpperCase(), cp);
  }

  // Commercial Wrapper Price Resolution:
  // In Xbox Store, multi-game bundles (like Mafia: Trilogy) often list 0 TL platform-specific leaf SKUs
  // in BundledSkus, while selling each game standalone via a commercial wrapper bundle W
  // whose BundledSkus S(W) is a strict subset of the parent bundle's S(B).
  const candidateWrapperIdsSet = new Set<string>();
  for (const cp of fetchedChildren) {
    if (cp.currentPrice === 0 && cp.relatedBundleIds && cp.relatedBundleIds.length > 0) {
      for (const relId of cp.relatedBundleIds) {
        const cleanRelId = relId.trim().toUpperCase();
        if (
          cleanRelId.length === 12 &&
          cleanRelId !== cleanBundleBigId &&
          !allChildSet.has(cleanRelId)
        ) {
          candidateWrapperIdsSet.add(cleanRelId);
        }
      }
    }
  }

  if (candidateWrapperIdsSet.size > 0) {
    const wrapperIds = Array.from(candidateWrapperIdsSet).slice(0, 15);
    const wrappers = await client.fetchProductsBatch(wrapperIds);

    // Sort smallest subset first so the most specific commercial game wrapper wins
    wrappers.sort(
      (a, b) => (a.bundledProductIds?.length || 0) - (b.bundledProductIds?.length || 0)
    );

    const coveredLeafIds = new Set<string>();

    for (const wp of wrappers) {
      const wpKids = (wp.bundledProductIds || []).map((id) => id.trim().toUpperCase());
      if (
        wp.currentPrice > 0 &&
        wpKids.length > 0 &&
        wpKids.length < allChildBigIds.length &&
        wpKids.every((id) => allChildSet.has(id))
      ) {
        const candidateLeaves = wpKids
          .filter((id) => !coveredLeafIds.has(id))
          .map((id) => fetchedMap.get(id))
          .filter((item): item is NormalizedXboxProduct => Boolean(item));

        if (candidateLeaves.length > 0) {
          // Pick primary game SKU in this wrapper (prefer Series X|S base game, then any base game)
          const primaryLeaf =
            candidateLeaves.find(
              (c) =>
                c.currentPrice === 0 &&
                (c.productClass === "BASE_GAME" || c.productType.toLowerCase() === "game") &&
                (c.platforms.includes("XboxSeriesX") || /series/i.test(c.title))
            ) ||
            candidateLeaves.find(
              (c) =>
                c.currentPrice === 0 &&
                (c.productClass === "BASE_GAME" || c.productType.toLowerCase() === "game")
            ) ||
            candidateLeaves.find((c) => c.currentPrice === 0);

          if (primaryLeaf) {
            primaryLeaf.currentPrice = wp.currentPrice;
            primaryLeaf.listPrice = wp.listPrice;
            primaryLeaf.discountPercent = wp.discountPercent;
            primaryLeaf.isOnSale = wp.isOnSale;
            primaryLeaf.saleStartAt = wp.saleStartAt;
            primaryLeaf.saleEndAt = wp.saleEndAt;
            primaryLeaf.isFree = false;
          }

          for (const id of wpKids) {
            coveredLeafIds.add(id);
          }
        }
      }
    }
  }

  // Upsert each child product and link BUNDLE_CONTAINS relation
  const validChildDbIds: string[] = [];

  for (let i = 0; i < allChildBigIds.length; i++) {
    const childBigId = allChildBigIds[i];
    const cp = fetchedMap.get(childBigId);

    try {
      if (cp) {
        const qual = qualifyXboxSeriesPlatform({
          productId: cp.productId,
          availableOn: cp.platforms,
          currentPrice: cp.currentPrice,
          listPrice: cp.listPrice,
          isFree: cp.isFree,
          productType: cp.productType,
          parentIsSeriesCompatible: true,
        });

        await processNormalizedProduct(cp, {
          discoverySource: "BUNDLE_CHILD",
          platforms: qual.platforms,
          isSeriesXCompatible: qual.platforms.includes("XboxSeriesX"),
        });
      }

      const childInDb = await prisma.game.findUnique({
        where: { xboxProductId: childBigId },
        select: { id: true },
      });

      if (childInDb) {
        validChildDbIds.push(childInDb.id);
        await prisma.gameRelation.upsert({
          where: {
            parentGameId_childGameId_relationType: {
              parentGameId: bundleGameId,
              childGameId: childInDb.id,
              relationType: RelationType.BUNDLE_CONTAINS,
            },
          },
          create: {
            parentGameId: bundleGameId,
            childGameId: childInDb.id,
            relationType: RelationType.BUNDLE_CONTAINS,
            position: i,
            source: BUNDLE_RELATION_SOURCE_V2,
          },
          update: {
            position: i,
            source: BUNDLE_RELATION_SOURCE_V2,
          },
        });
      }
    } catch (childErr: any) {
      console.warn(`[BundleEnricher] Child ${childBigId} upsert warning:`, childErr.message);
    }
  }

  // Remove any stale BUNDLE_CONTAINS relation on this bundle that is not part of its official BundledSkus
  if (validChildDbIds.length > 0) {
    await prisma.gameRelation.deleteMany({
      where: {
        parentGameId: bundleGameId,
        relationType: RelationType.BUNDLE_CONTAINS,
        childGameId: { notIn: validChildDbIds },
      },
    });
  }

  return {
    updated: true,
    childCount: validChildDbIds.length,
  };
}
