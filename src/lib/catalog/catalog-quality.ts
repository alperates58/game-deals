import { prisma } from "../db/prisma";
import { ProductClass, RelationType } from "@prisma/client";

export type QualityGrade = "EXCELLENT" | "HEALTHY" | "NEEDS_ATTENTION" | "DEGRADED";

export type QualityIssueType =
  | "UNKNOWN_PRODUCT_CLASS"
  | "MISSING_CURRENT_PRICE"
  | "MISSING_LIST_PRICE"
  | "MISSING_IMAGE"
  | "MISSING_RELEASE_DATE"
  | "MISSING_PLATFORM"
  | "NO_PRICE_HISTORY"
  | "ORPHAN_RELATION"
  | "DUPLICATE_RELATION"
  | "BUNDLE_WITHOUT_CHILDREN"
  | "SUSPICIOUS_BUNDLE_RELATION"
  | "STALE_PRICE"
  | "STALE_METADATA"
  | "ZERO_PRICE_COMMERCIAL"
  | "INVALID_DISCOUNT"
  | "PRICE_ABOVE_LIST_PRICE"
  | "HISTORICAL_LOW_ANOMALY"
  | "INACTIVE_RECENTLY_SEEN"
  | "DISCOVERY_GAP";

export interface QualityMetricSummary {
  key: QualityIssueType;
  label: string;
  description: string;
  count: number;
  severity: "CRITICAL" | "MAJOR" | "MINOR";
  weight: number;
}

export interface CatalogQualityReport {
  timestamp: string;
  totalProducts: number;
  healthyProducts: number;
  needsReviewProducts: number;
  healthScore: number; // 0 - 100
  grade: QualityGrade;
  metrics: Record<QualityIssueType, QualityMetricSummary>;
  sanityChecks: {
    wukongDiscovered: boolean;
    wukongBigId: string;
    status: "PASS" | "FAIL";
  };
}

export interface QualityIssueItem {
  id: string;
  title: string;
  bigId: string;
  productClass: string;
  platform: string;
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  lastSeen: string;
  issueReason: string;
}

// Canonical Sanity Reference: Black Myth: Wukong
const SANITY_WUKONG_BIG_ID = "9NWQ1Q1FR0C9";

/**
 * Metric Definitions and Weights
 * Severity:
 * - CRITICAL: 2.5 weight (pricing, integrity, childless bundles, anomalies)
 * - MAJOR: 1.5 weight (classification, platform, image, gaps)
 * - MINOR: 0.5 weight (staleness, dates)
 */
const METRIC_DEFINITIONS: Record<
  QualityIssueType,
  { label: string; description: string; severity: "CRITICAL" | "MAJOR" | "MINOR"; weight: number }
> = {
  UNKNOWN_PRODUCT_CLASS: {
    label: "Sınıflandırılamayan Ürünler",
    description: "Katalogda productClass değeri UNKNOWN olan oyun veya eklentiler.",
    severity: "MAJOR",
    weight: 1.5,
  },
  MISSING_CURRENT_PRICE: {
    label: "Mevcut Fiyatı Eksik",
    description: "Satışta olan ancak currentPrice değeri bulunmayan kayıtlar.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  MISSING_LIST_PRICE: {
    label: "Liste Fiyatı Eksik",
    description: "Katalogda listPrice (MSRP) değeri kaydedilmemiş ürünler.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  MISSING_IMAGE: {
    label: "Görseli Eksik",
    description: "Kapak veya afiş görseli (imageUrl) bulunmayan veya boş olan ürünler.",
    severity: "MAJOR",
    weight: 1.5,
  },
  MISSING_RELEASE_DATE: {
    label: "Çıkış Tarihi Eksik",
    description: "Microsoft mağazasında releaseDate bilgisi boş olan ürünler.",
    severity: "MINOR",
    weight: 0.5,
  },
  MISSING_PLATFORM: {
    label: "Platformu Eksik",
    description: "Xbox Series X|S veya Xbox One platform etiketi atanmamış kayıtlar.",
    severity: "MAJOR",
    weight: 1.5,
  },
  NO_PRICE_HISTORY: {
    label: "Fiyat Geçmişi Olmayan",
    description: "Veritabanında henüz hiç PriceHistory kaydı bulunmayan aktif oyunlar.",
    severity: "MAJOR",
    weight: 1.5,
  },
  ORPHAN_RELATION: {
    label: "Yetim İlişkiler",
    description: "Parent veya Child kaydı silinmiş veya geçersiz olan ilişki kayıtları.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  DUPLICATE_RELATION: {
    label: "Mükerrer İlişkiler",
    description: "Aynı iki oyun arasında aynı türde birden fazla tanımlanmış ilişkiler.",
    severity: "MAJOR",
    weight: 1.5,
  },
  BUNDLE_WITHOUT_CHILDREN: {
    label: "İçeriksiz Paketler (Bundle)",
    description: "Paket (BUNDLE) olarak işaretlenmiş ancak alt oyunu/eklentisi bağlanmamış kayıtlar.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  SUSPICIOUS_BUNDLE_RELATION: {
    label: "Şüpheli Paket İlişkileri",
    description: "Kendi kendinin çocuğu olan veya döngüsel/çelişkili paket ilişkileri.",
    severity: "MAJOR",
    weight: 1.5,
  },
  STALE_PRICE: {
    label: "Eski Fiyat Verisi",
    description: "14 günden uzun süredir fiyat sorgusu yapılmamış aktif oyunlar.",
    severity: "MINOR",
    weight: 0.5,
  },
  STALE_METADATA: {
    label: "Eski Metadata",
    description: "30 günden uzun süredir metadata güncellemesi görmemiş ürünler.",
    severity: "MINOR",
    weight: 0.5,
  },
  ZERO_PRICE_COMMERCIAL: {
    label: "0 TL Ticari Ürünler",
    description: "Ücretsiz (isFree=false) işaretli fakat 0 TL fiyatla duran anormal ticari kayıtlar.",
    severity: "MAJOR",
    weight: 1.5,
  },
  INVALID_DISCOUNT: {
    label: "Hatalı İndirim Oranı",
    description: "%100'den büyük, negatif veya liste fiyatından pahalı olmasına rağmen indirimli görünenler.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  PRICE_ABOVE_LIST_PRICE: {
    label: "Mevcut Fiyat > Liste Fiyatı",
    description: "Mevcut fiyatı liste fiyatından yüksek olan anomali kayıtları.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  HISTORICAL_LOW_ANOMALY: {
    label: "Tarihi Dip > Mevcut Fiyat",
    description: "Kayıtlı en dip fiyatı mevcut fiyattan daha yüksek olan tutarsızlıklar.",
    severity: "CRITICAL",
    weight: 2.5,
  },
  INACTIVE_RECENTLY_SEEN: {
    label: "Pasif Ama Yakın Zamanda Görülen",
    description: "Katalogda isActive=false yapılmış fakat son 7 günde mağazada görünen ürünler.",
    severity: "MINOR",
    weight: 0.5,
  },
  DISCOVERY_GAP: {
    label: "Eksik Referans Oyunlar (Sanity)",
    description: "Black Myth: Wukong gibi zorunlu referans ürünlerin veritabanında bulunamaması.",
    severity: "MAJOR",
    weight: 1.5,
  },
};

/**
 * Evaluates full catalog data quality and calculates deterministic Catalog Health Score.
 */
export async function getCatalogQualityReport(): Promise<CatalogQualityReport> {
  const now = new Date();
  const stalePriceThreshold = new Date(now.getTime() - 14 * 86400 * 1000);
  const staleMetadataThreshold = new Date(now.getTime() - 30 * 86400 * 1000);
  const recentSeenThreshold = new Date(now.getTime() - 7 * 86400 * 1000);

  // 1. Fetch total products count
  const totalProducts = await prisma.game.count();

  // 2. Query quality checks concurrently
  const [
    unknownClassCount,
    missingImageCount,
    missingReleaseDateCount,
    missingPlatformCount,
    noPriceHistoryCount,
    bundlesWithoutChildrenCount,
    stalePriceCount,
    staleMetadataCount,
    zeroPriceCommercialCount,
    inactiveRecentlySeenCount,
    wukongGame,
    allGamesPriceStats,
    allRelations,
  ] = await Promise.all([
    // Unknown class
    prisma.game.count({ where: { productClass: ProductClass.UNKNOWN } }),

    // Missing image
    prisma.game.count({
      where: {
        OR: [
          { imageUrl: null },
          { imageUrl: "" },
        ],
      },
    }),

    // Missing release date
    prisma.game.count({ where: { releaseDate: null } }),

    // Missing platform
    prisma.game.count({ where: { platforms: { isEmpty: true } } }),

    // Games without price history
    prisma.game.count({
      where: {
        isActive: true,
        priceHistories: { none: {} },
      },
    }),

    // Bundles without child relations
    prisma.game.count({
      where: {
        productClass: ProductClass.BUNDLE,
        childRelations: { none: {} },
      },
    }),

    // Stale price (not seen in > 14 days)
    prisma.game.count({
      where: {
        isActive: true,
        lastSeenAt: { lt: stalePriceThreshold },
      },
    }),

    // Stale metadata (updated > 30 days ago)
    prisma.game.count({
      where: {
        isActive: true,
        updatedAt: { lt: staleMetadataThreshold },
      },
    }),

    // Zero price commercial products (isFree=false, price=0, not a bundle)
    prisma.game.count({
      where: {
        isFree: false,
        currentPrice: 0,
        listPrice: 0,
        productClass: { notIn: [ProductClass.BUNDLE, ProductClass.UNKNOWN] },
      },
    }),

    // Inactive but recently seen
    prisma.game.count({
      where: {
        isActive: false,
        lastSeenAt: { gt: recentSeenThreshold },
      },
    }),

    // Sanity check: Black Myth: Wukong
    prisma.game.findUnique({
      where: { xboxProductId: SANITY_WUKONG_BIG_ID },
      select: { id: true, title: true },
    }),

    // Price anomalies query (all games currentPrice, listPrice, discountPercent, historicalLow)
    prisma.game.findMany({
      select: {
        id: true,
        currentPrice: true,
        listPrice: true,
        discountPercent: true,
        historicalLow: true,
        isFree: true,
      },
    }),

    // Relations integrity check
    prisma.gameRelation.findMany({
      select: {
        id: true,
        parentGameId: true,
        childGameId: true,
        relationType: true,
      },
    }),
  ]);

  // Compute pricing anomalies in memory
  let missingCurrentPriceCount = 0;
  let missingListPriceCount = 0;
  let invalidDiscountCount = 0;
  let priceAboveListCount = 0;
  let historicalLowAnomalyCount = 0;

  for (const g of allGamesPriceStats) {
    if (g.currentPrice === null || g.currentPrice === undefined) {
      missingCurrentPriceCount++;
    }
    if (g.listPrice === null || g.listPrice === undefined) {
      missingListPriceCount++;
    }

    const curr = g.currentPrice ? g.currentPrice.toNumber() : 0;
    const list = g.listPrice ? g.listPrice.toNumber() : 0;
    const disc = g.discountPercent ?? 0;
    const low = g.historicalLow ? g.historicalLow.toNumber() : 0;

    // Invalid discount
    if (disc < 0 || disc > 100 || (disc > 0 && curr >= list)) {
      invalidDiscountCount++;
    }

    // Current price > list price
    if (list > 0 && curr > list) {
      priceAboveListCount++;
    }

    // Historical low > current price (when curr > 0)
    if (curr > 0 && low > curr) {
      historicalLowAnomalyCount++;
    }
  }

  // Relations checks (duplicates, self-references)
  let duplicateRelationCount = 0;
  let suspiciousBundleCount = 0;
  const relationKeys = new Set<string>();

  for (const r of allRelations) {
    const key = `${r.parentGameId}_${r.childGameId}_${r.relationType}`;
    if (relationKeys.has(key)) {
      duplicateRelationCount++;
    } else {
      relationKeys.add(key);
    }

    if (r.parentGameId === r.childGameId) {
      suspiciousBundleCount++;
    }
  }

  // Orphan relations: check if any relation points to missing Game ID
  const allGameIds = new Set(allGamesPriceStats.map((g) => g.id));
  let orphanRelationCount = 0;
  for (const r of allRelations) {
    if (!allGameIds.has(r.parentGameId) || !allGameIds.has(r.childGameId)) {
      orphanRelationCount++;
    }
  }

  // Sanity check
  const wukongDiscovered = Boolean(wukongGame);
  const discoveryGapCount = wukongDiscovered ? 0 : 1;

  // Build metrics map
  const rawCounts: Record<QualityIssueType, number> = {
    UNKNOWN_PRODUCT_CLASS: unknownClassCount,
    MISSING_CURRENT_PRICE: missingCurrentPriceCount,
    MISSING_LIST_PRICE: missingListPriceCount,
    MISSING_IMAGE: missingImageCount,
    MISSING_RELEASE_DATE: missingReleaseDateCount,
    MISSING_PLATFORM: missingPlatformCount,
    NO_PRICE_HISTORY: noPriceHistoryCount,
    ORPHAN_RELATION: orphanRelationCount,
    DUPLICATE_RELATION: duplicateRelationCount,
    BUNDLE_WITHOUT_CHILDREN: bundlesWithoutChildrenCount,
    SUSPICIOUS_BUNDLE_RELATION: suspiciousBundleCount,
    STALE_PRICE: stalePriceCount,
    STALE_METADATA: staleMetadataCount,
    ZERO_PRICE_COMMERCIAL: zeroPriceCommercialCount,
    INVALID_DISCOUNT: invalidDiscountCount,
    PRICE_ABOVE_LIST_PRICE: priceAboveListCount,
    HISTORICAL_LOW_ANOMALY: historicalLowAnomalyCount,
    INACTIVE_RECENTLY_SEEN: inactiveRecentlySeenCount,
    DISCOVERY_GAP: discoveryGapCount,
  };

  const metrics: Record<QualityIssueType, QualityMetricSummary> = {} as any;
  let totalPenalty = 0;
  const effectiveTotal = Math.max(totalProducts, 1);

  for (const [key, def] of Object.entries(METRIC_DEFINITIONS) as [QualityIssueType, any][]) {
    const count = rawCounts[key] || 0;
    metrics[key] = {
      key,
      label: def.label,
      description: def.description,
      count,
      severity: def.severity,
      weight: def.weight,
    };

    // Penalty calculation:
    // Ratio of affected items * weight, capped per issue category
    if (count > 0) {
      const ratio = count / effectiveTotal;
      const penalty = Math.min(ratio * def.weight * 100, def.severity === "CRITICAL" ? 30 : def.severity === "MAJOR" ? 20 : 10);
      totalPenalty += penalty;
    }
  }

  // Health Score calculation (0 - 100)
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

  let grade: QualityGrade = "EXCELLENT";
  if (healthScore < 90) {
    grade = "DEGRADED";
  } else if (healthScore < 95) {
    grade = "NEEDS_ATTENTION";
  } else if (healthScore < 99) {
    grade = "HEALTHY";
  }

  // Count distinct problem products
  const problemProductCount = Math.min(
    totalProducts,
    unknownClassCount +
      missingCurrentPriceCount +
      missingImageCount +
      missingPlatformCount +
      bundlesWithoutChildrenCount +
      invalidDiscountCount +
      priceAboveListCount +
      historicalLowAnomalyCount +
      zeroPriceCommercialCount
  );

  const healthyProducts = Math.max(0, totalProducts - problemProductCount);
  const needsReviewProducts = totalProducts - healthyProducts;

  return {
    timestamp: now.toISOString(),
    totalProducts,
    healthyProducts,
    needsReviewProducts,
    healthScore,
    grade,
    metrics,
    sanityChecks: {
      wukongDiscovered,
      wukongBigId: SANITY_WUKONG_BIG_ID,
      status: wukongDiscovered ? "PASS" : "FAIL",
    },
  };
}

/**
 * Retrieves detailed drill-down item list for a specific quality issue.
 */
export async function getQualityIssueItems(
  issueType: QualityIssueType,
  limit = 50,
  offset = 0
): Promise<{ total: number; items: QualityIssueItem[] }> {
  const now = new Date();
  const stalePriceThreshold = new Date(now.getTime() - 14 * 86400 * 1000);
  const staleMetadataThreshold = new Date(now.getTime() - 30 * 86400 * 1000);
  const recentSeenThreshold = new Date(now.getTime() - 7 * 86400 * 1000);

  let whereClause: any = {};
  let issueReasonGenerator = (g: any) => "Kalite sorunu tespit edildi.";

  switch (issueType) {
    case "UNKNOWN_PRODUCT_CLASS":
      whereClause = { productClass: ProductClass.UNKNOWN };
      issueReasonGenerator = () => "Ürün sınıfı UNKNOWN olarak kayıtlı, sınıflandırma bekleniyor.";
      break;

    case "MISSING_IMAGE":
      whereClause = { OR: [{ imageUrl: null }, { imageUrl: "" }] };
      issueReasonGenerator = () => "Afiş/kapak görseli bağlantısı eksik.";
      break;

    case "MISSING_RELEASE_DATE":
      whereClause = { releaseDate: null };
      issueReasonGenerator = () => "Çıkış tarihi bilgisi mağazada tanımlanmamış.";
      break;

    case "MISSING_PLATFORM":
      whereClause = { platforms: { isEmpty: true } };
      issueReasonGenerator = () => "Xbox Series X|S veya One platform desteği atanmamış.";
      break;

    case "NO_PRICE_HISTORY":
      whereClause = { isActive: true, priceHistories: { none: {} } };
      issueReasonGenerator = () => "Fiyat takip tablosunda (PriceHistory) hiçbir geçmiş kaydı yok.";
      break;

    case "BUNDLE_WITHOUT_CHILDREN":
      whereClause = { productClass: ProductClass.BUNDLE, childRelations: { none: {} } };
      issueReasonGenerator = () => "Paket (BUNDLE) olmasına rağmen içeriğindeki oyun veya eklentiler bağlanmamış.";
      break;

    case "STALE_PRICE":
      whereClause = { isActive: true, lastSeenAt: { lt: stalePriceThreshold } };
      issueReasonGenerator = (g: any) => `14 günden uzun süredir (${new Date(g.lastSeenAt).toLocaleDateString("tr-TR")}) fiyat sorgusu yapılmadı.`;
      break;

    case "STALE_METADATA":
      whereClause = { isActive: true, updatedAt: { lt: staleMetadataThreshold } };
      issueReasonGenerator = (g: any) => `30 günden uzun süredir (${new Date(g.updatedAt).toLocaleDateString("tr-TR")}) metadata güncellenmedi.`;
      break;

    case "ZERO_PRICE_COMMERCIAL":
      whereClause = {
        isFree: false,
        currentPrice: 0,
        listPrice: 0,
        productClass: { notIn: [ProductClass.BUNDLE, ProductClass.UNKNOWN] },
      };
      issueReasonGenerator = () => "Ücretsiz olmayan oyun 0 TL / 0 TL liste fiyatıyla kayıtlı (Anomali).";
      break;

    case "INACTIVE_RECENTLY_SEEN":
      whereClause = { isActive: false, lastSeenAt: { gt: recentSeenThreshold } };
      issueReasonGenerator = (g: any) => `Ürün pasif durumda ancak ${new Date(g.lastSeenAt).toLocaleDateString("tr-TR")} tarihinde mağazada görüldü.`;
      break;

    case "DISCOVERY_GAP":
      whereClause = { xboxProductId: SANITY_WUKONG_BIG_ID };
      issueReasonGenerator = () => "Sanity referansı Black Myth: Wukong kontrolü.";
      break;

    default:
      whereClause = {};
      break;
  }

  const [total, games] = await Promise.all([
    prisma.game.count({ where: whereClause }),
    prisma.game.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        xboxProductId: true,
        productClass: true,
        platforms: true,
        currentPrice: true,
        listPrice: true,
        discountPercent: true,
        lastSeenAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  const items: QualityIssueItem[] = games.map((g) => ({
    id: g.id,
    title: g.title,
    bigId: g.xboxProductId,
    productClass: g.productClass,
    platform: g.platforms.join(", ") || "Belirtilmemiş",
    currentPrice: g.currentPrice ? g.currentPrice.toNumber() : 0,
    listPrice: g.listPrice ? g.listPrice.toNumber() : 0,
    discountPercent: g.discountPercent || 0,
    lastSeen: g.lastSeenAt.toISOString(),
    issueReason: issueReasonGenerator(g),
  }));

  return { total, items };
}
