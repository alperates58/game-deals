import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";
import { CarouselGameItem } from "@/components/home/deals-carousel";
import { FeaturedDealItem } from "@/components/home/featured-deals-slider";

export type PlatformFilter = "ALL" | "PC" | "XboxSeriesX" | "XboxOne" | "Xbox";
export type ProductClassFilter = "ALL" | "BASE_GAME" | "BUNDLE" | "ADD_ON";

export type SectionQueryType =
  | "HISTORICAL_LOW"
  | "DEEP_DISCOUNT"
  | "DEAL_SCORE"
  | "BUDGET"
  | "PRICE_DROPS"
  | "BUNDLES"
  | "POPULAR"
  | "FREE"
  | "CUSTOM";

export type SortByOption =
  | "DEAL_SCORE_DESC"
  | "DISCOUNT_DESC"
  | "HISTORICAL_LOW_DATE"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "RECENT_DROPS"
  | "POPULARITY_DESC"
  | "NEWEST_DISCOVERY";

export interface HomepageSectionConfig {
  id: string;
  enabled: boolean;
  order: number;
  title: string;
  subtitle: string;
  badgeText: string;
  icon: string; // "flame" | "trending-down" | "sparkles" | "dollar-sign" | "package" | "award" | "gamepad" | "monitor" | "tag" | "gift"
  iconStyle?: string;
  queryType: SectionQueryType;
  platform: PlatformFilter;
  productClass: ProductClassFilter;
  onlyHistoricalLow?: boolean;
  minDiscountPercent?: number;
  maxDiscountPercent?: number;
  minDealScore?: number;
  minPrice?: number;
  maxPrice?: number;
  onlyFree?: boolean;
  sortBy: SortByOption;
  limit: number;
  viewAllUrl?: string;
  highlightBadge?: "historicalLow" | "dealScore" | "budget";
}

export interface HeroSliderConfig {
  enabled: boolean;
  title: string;
  platform: PlatformFilter;
  filter: "DEAL_SCORE" | "DISCOUNT" | "HISTORICAL_LOW";
  minDiscount: number;
  limit: number;
  autoplaySeconds: number;
}

export interface HomepageConfig {
  heroSlider: HeroSliderConfig;
  sections: HomepageSectionConfig[];
}

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  heroSlider: {
    enabled: true,
    title: "Günün Öne Çıkan Fırsatları",
    platform: "ALL",
    filter: "DEAL_SCORE",
    minDiscount: 0,
    limit: 15,
    autoplaySeconds: 5,
  },
  sections: [
    {
      id: "historical-lows",
      enabled: true,
      order: 1,
      title: "Tarihi Dip Fırsatları Vitrini",
      subtitle: "Sistemimizin gözlemlediği en düşük fiyata inen oyunlar ve eklentiler",
      badgeText: "Tarihi Dip",
      icon: "trending-down",
      iconStyle: "bg-emerald-950 border-emerald-500/40 text-emerald-400",
      queryType: "HISTORICAL_LOW",
      platform: "ALL",
      productClass: "ALL",
      onlyHistoricalLow: true,
      minDiscountPercent: 1,
      sortBy: "HISTORICAL_LOW_DATE",
      limit: 30,
      viewAllUrl: "/tarihi-dip",
      highlightBadge: "historicalLow",
    },
    {
      id: "deep-discounts",
      enabled: true,
      order: 2,
      title: "%70 ve Üzeri Dev İndirimler",
      subtitle: "Xbox Store'daki en yüksek indirim oranına sahip seçkin fırsatlar",
      badgeText: "Dev İndirimler (%70+)",
      icon: "flame",
      iconStyle: "bg-red-950/60 border-red-500/40 text-red-400",
      queryType: "DEEP_DISCOUNT",
      platform: "ALL",
      productClass: "ALL",
      minDiscountPercent: 70,
      sortBy: "DISCOUNT_DESC",
      limit: 15,
      viewAllUrl: "/firsatlar?minDiscount=70",
      highlightBadge: "dealScore",
    },
    {
      id: "budget-gems",
      enabled: true,
      order: 3,
      title: "150 TL Altı Bütçe Dostu Fırsatlar",
      subtitle: "Cebinizi yormayacak yüksek puanlı kaliteli oyunlar",
      badgeText: "Bütçe Dostu (<=150 TL)",
      icon: "dollar-sign",
      iconStyle: "bg-amber-950/60 border-amber-500/40 text-amber-400",
      queryType: "BUDGET",
      platform: "ALL",
      productClass: "ALL",
      minDiscountPercent: 25,
      maxPrice: 150,
      sortBy: "DISCOUNT_DESC",
      limit: 15,
      viewAllUrl: "/firsatlar?maxPrice=150",
      highlightBadge: "budget",
    },
    {
      id: "recent-drops",
      enabled: true,
      order: 4,
      title: "Fiyatı Yeni Düşenler",
      subtitle: "Takip listesinde son güncellemeyle fiyat indirimi alan oyunlar",
      badgeText: "Yeni İndirimler",
      icon: "sparkles",
      iconStyle: "bg-cyan-950/60 border-cyan-500/40 text-cyan-400",
      queryType: "PRICE_DROPS",
      platform: "ALL",
      productClass: "ALL",
      minDiscountPercent: 1,
      sortBy: "RECENT_DROPS",
      limit: 15,
      viewAllUrl: "/firsatlar",
      highlightBadge: "dealScore",
    },
    {
      id: "bundle-deals",
      enabled: true,
      order: 5,
      title: "İndirimli Paketler ve Koleksiyonlar",
      subtitle: "Birden fazla oyun içeren avantajlı paketler ve genişletme sürümleri",
      badgeText: "Paketler",
      icon: "package",
      iconStyle: "bg-purple-950/60 border-purple-500/40 text-purple-400",
      queryType: "BUNDLES",
      platform: "ALL",
      productClass: "BUNDLE",
      minDiscountPercent: 1,
      sortBy: "DISCOUNT_DESC",
      limit: 15,
      viewAllUrl: "/eklentiler",
      highlightBadge: "dealScore",
    },
    {
      id: "popular-games",
      enabled: true,
      order: 6,
      title: "Öne Çıkan Popüler Oyunlar",
      subtitle: "Xbox ekosisteminde en çok ilgi gören ana yapımlar",
      badgeText: "Popüler",
      icon: "award",
      iconStyle: "bg-blue-950/60 border-blue-500/40 text-blue-400",
      queryType: "POPULAR",
      platform: "ALL",
      productClass: "BASE_GAME",
      sortBy: "POPULARITY_DESC",
      limit: 8,
      viewAllUrl: "/firsatlar",
      highlightBadge: "dealScore",
    },
  ],
};

/**
 * Loads the active homepage configuration from SystemSetting or returns defaults.
 */
export async function getHomepageConfig(db = prisma): Promise<HomepageConfig> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { id: "global" },
      select: { homepageConfig: true },
    });

    if (setting?.homepageConfig && typeof setting.homepageConfig === "object") {
      const cfg = setting.homepageConfig as any;
      if (Array.isArray(cfg.sections) && cfg.heroSlider) {
        return {
          heroSlider: {
            ...DEFAULT_HOMEPAGE_CONFIG.heroSlider,
            ...cfg.heroSlider,
          },
          sections: cfg.sections.map((s: any, idx: number) => ({
            ...s,
            order: typeof s.order === "number" ? s.order : idx + 1,
          })),
        };
      }
    }
  } catch (err: any) {
    console.warn("[getHomepageConfig Warning]", err?.message || err);
  }

  return DEFAULT_HOMEPAGE_CONFIG;
}

/**
 * Saves a new homepage configuration to SystemSetting.
 */
export async function saveHomepageConfig(config: HomepageConfig, db = prisma): Promise<HomepageConfig> {
  await db.systemSetting.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      homepageConfig: config as any,
    },
    update: {
      homepageConfig: config as any,
    },
  });

  return config;
}

/**
 * Resets homepage configuration to the system defaults.
 */
export async function resetHomepageConfig(db = prisma): Promise<HomepageConfig> {
  await db.systemSetting.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      homepageConfig: DEFAULT_HOMEPAGE_CONFIG as any,
    },
    update: {
      homepageConfig: DEFAULT_HOMEPAGE_CONFIG as any,
    },
  });

  return DEFAULT_HOMEPAGE_CONFIG;
}

/**
 * Helper to build Prisma where clause from section config.
 */
function buildSectionWhereClause(section: HomepageSectionConfig): Prisma.GameWhereInput {
  const where: Prisma.GameWhereInput = {
    isActive: true,
    isPlatformVariant: false,
  };

  // Platform Filter
  if (section.platform && section.platform !== "ALL") {
    if (section.platform === "Xbox") {
      where.platforms = { hasSome: ["Xbox", "XboxSeriesX", "XboxOne"] };
    } else {
      where.platforms = { has: section.platform };
    }
  }

  // Product Class Filter
  if (section.productClass && section.productClass !== "ALL") {
    if (section.productClass === "ADD_ON") {
      where.productClass = { in: ["ADD_ON", "CONTENT_PACK", "SEASON_PASS"] };
    } else {
      where.productClass = section.productClass;
    }
  }

  // Discount Filters
  if (section.minDiscountPercent && section.minDiscountPercent > 0) {
    where.discountPercent = { gte: section.minDiscountPercent };
  }
  if (section.maxDiscountPercent && section.maxDiscountPercent > 0) {
    where.discountPercent = {
      ...(where.discountPercent as Prisma.IntFilter || {}),
      lte: section.maxDiscountPercent,
    };
  }

  // Price Filters
  if (section.minPrice !== undefined && section.minPrice > 0) {
    where.currentPrice = {
      ...(where.currentPrice as Prisma.DecimalFilter || {}),
      gte: section.minPrice,
    };
  }
  if (section.maxPrice !== undefined && section.maxPrice > 0) {
    where.currentPrice = {
      ...(where.currentPrice as Prisma.DecimalFilter || {}),
      lte: section.maxPrice,
      gt: 0,
    };
  }

  // Free only
  if (section.onlyFree) {
    where.OR = [{ isFree: true }, { currentPrice: 0 }];
  }

  // Deal score
  if (section.minDealScore && section.minDealScore > 0) {
    where.dealAnalysis = {
      dealScore: { gte: section.minDealScore },
    };
  }

  // Popular / Core games
  if (section.queryType === "POPULAR") {
    where.isCore = true;
  }

  return where;
}

/**
 * Builds Prisma orderBy clause from section config.
 */
function buildSectionOrderBy(section: HomepageSectionConfig): Prisma.GameOrderByWithRelationInput[] {
  switch (section.sortBy) {
    case "DEAL_SCORE_DESC":
      return [
        { dealAnalysis: { dealScore: "desc" } },
        { discountPercent: "desc" },
      ];
    case "DISCOUNT_DESC":
      return [
        { discountPercent: "desc" },
        { dealAnalysis: { dealScore: "desc" } },
      ];
    case "HISTORICAL_LOW_DATE":
      return [
        { historicalLowAt: "desc" },
        { discountPercent: "desc" },
      ];
    case "PRICE_ASC":
      return [
        { currentPrice: "asc" },
        { discountPercent: "desc" },
      ];
    case "PRICE_DESC":
      return [
        { currentPrice: "desc" },
      ];
    case "POPULARITY_DESC":
      return [
        { isCore: "desc" },
        { popularityScore: "desc" },
        { updatedAt: "desc" },
      ];
    case "NEWEST_DISCOVERY":
      return [
        { firstSeenAt: "desc" },
      ];
    case "RECENT_DROPS":
    default:
      return [
        { updatedAt: "desc" },
        { discountPercent: "desc" },
      ];
  }
}

/**
 * Fetches games for a section based on its full filter and sort specification.
 */
export async function fetchSectionGames(
  section: HomepageSectionConfig,
  db = prisma
): Promise<CarouselGameItem[]> {
  if (!section.enabled) return [];

  // Special case: PRICE_DROPS (Games with strictly lower observed price in PriceHistory)
  if (section.queryType === "PRICE_DROPS" || section.sortBy === "RECENT_DROPS") {
    try {
      const platformSql = section.platform && section.platform !== "ALL"
        ? Prisma.sql`AND ${section.platform} = ANY(g."platforms")`
        : Prisma.empty;

      const rawDropIds = await db.$queryRaw<Array<{ id: string }>>`
        SELECT g.id
        FROM "Game" g
        JOIN "PriceHistory" ph_curr ON ph_curr."gameId" = g.id
        JOIN "PriceHistory" ph_prev ON ph_prev."gameId" = g.id AND ph_prev."observedAt" < ph_curr."observedAt"
        WHERE g."isActive" = true
          AND g."isPlatformVariant" = false
          AND g."discountPercent" > 0
          AND ph_curr."currentPrice" < ph_prev."currentPrice"
          ${platformSql}
          AND NOT EXISTS (
            SELECT 1 FROM "PriceHistory" ph_mid
            WHERE ph_mid."gameId" = g.id
              AND ph_mid."observedAt" > ph_prev."observedAt"
              AND ph_mid."observedAt" < ph_curr."observedAt"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "PriceHistory" ph_newer
            WHERE ph_newer."gameId" = g.id
              AND ph_newer."observedAt" > ph_curr."observedAt"
          )
        GROUP BY g.id
        ORDER BY MAX(ph_curr."observedAt") DESC
        LIMIT ${section.limit || 15}
      `;

      if (rawDropIds.length > 0) {
        const dropGames = await db.game.findMany({
          where: { id: { in: rawDropIds.map((r) => r.id) } },
          include: { dealAnalysis: true },
        });

        // Retain original SQL sort order
        const map = new Map(dropGames.map((g) => [g.id, g]));
        return rawDropIds
          .map((r) => map.get(r.id))
          .filter(Boolean)
          .map(transformToCarouselItem);
      }
    } catch (err: any) {
      console.warn("[fetchSectionGames Drops Error]", err?.message || err);
    }
  }

  // Special case: Strict HISTORICAL_LOW (currentPrice <= historicalLow)
  if (section.onlyHistoricalLow || section.queryType === "HISTORICAL_LOW") {
    try {
      const platformSql = section.platform && section.platform !== "ALL"
        ? Prisma.sql`AND ${section.platform} = ANY(g."platforms")`
        : Prisma.empty;

      const productClassSql = section.productClass && section.productClass !== "ALL"
        ? Prisma.sql`AND g."productClass"::text = ${section.productClass}`
        : Prisma.empty;

      const minDiscount = section.minDiscountPercent || 1;

      const rawDipIds = await db.$queryRaw<Array<{ id: string }>>`
        SELECT g.id
        FROM "Game" g
        WHERE g."isActive" = true
          AND g."isPlatformVariant" = false
          AND g."discountPercent" >= ${minDiscount}
          AND g."currentPrice" <= g."historicalLow"
          ${platformSql}
          ${productClassSql}
        ORDER BY g."historicalLowAt" DESC, g."discountPercent" DESC
        LIMIT ${section.limit || 30}
      `;

      if (rawDipIds.length > 0) {
        const dipGames = await db.game.findMany({
          where: { id: { in: rawDipIds.map((r) => r.id) } },
          include: { dealAnalysis: true },
        });

        const map = new Map(dipGames.map((g) => [g.id, g]));
        return rawDipIds
          .map((r) => map.get(r.id))
          .filter(Boolean)
          .map(transformToCarouselItem);
      }
    } catch (err: any) {
      console.warn("[fetchSectionGames Dip Error]", err?.message || err);
    }
  }

  // Standard Prisma query for other sections
  const where = buildSectionWhereClause(section);
  const orderBy = buildSectionOrderBy(section);

  const games = await db.game.findMany({
    where,
    orderBy,
    take: section.limit || 15,
    include: {
      dealAnalysis: true,
    },
  });

  return games.map(transformToCarouselItem);
}

/**
 * Fetches games for the hero slider based on slider configuration.
 */
export async function fetchHeroSliderGames(
  slider: HeroSliderConfig,
  db = prisma
): Promise<FeaturedDealItem[]> {
  if (!slider.enabled) return [];

  const where: Prisma.GameWhereInput = {
    isActive: true,
    isPlatformVariant: false,
    discountPercent: { gte: slider.minDiscount || 1 },
  };

  if (slider.platform && slider.platform !== "ALL") {
    if (slider.platform === "Xbox") {
      where.platforms = { hasSome: ["Xbox", "XboxSeriesX", "XboxOne"] };
    } else {
      where.platforms = { has: slider.platform };
    }
  }

  let orderBy: Prisma.GameOrderByWithRelationInput[] = [
    { dealAnalysis: { dealScore: "desc" } },
    { discountPercent: "desc" },
  ];

  if (slider.filter === "DISCOUNT") {
    orderBy = [
      { discountPercent: "desc" },
      { dealAnalysis: { dealScore: "desc" } },
    ];
  } else if (slider.filter === "HISTORICAL_LOW") {
    orderBy = [
      { historicalLowAt: "desc" },
      { discountPercent: "desc" },
    ];
  }

  const games = await db.game.findMany({
    where,
    orderBy,
    take: slider.limit || 15,
    include: {
      dealAnalysis: true,
    },
  });

  return games.map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    publisher: g.publisher,
    imageUrl: g.imageUrl,
    screenshots: g.screenshots || [],
    currentPrice: g.currentPrice.toNumber(),
    listPrice: g.listPrice.toNumber(),
    discountPercent: g.discountPercent,
    currency: g.currency,
    historicalLow: g.historicalLow.toNumber(),
    dealAnalysis: g.dealAnalysis
      ? {
          dealScore: g.dealAnalysis.dealScore,
          verdict: g.dealAnalysis.verdict,
        }
      : null,
  }));
}

function transformToCarouselItem(game: any): CarouselGameItem {
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    publisher: game.publisher,
    imageUrl: game.imageUrl,
    currentPrice: game.currentPrice.toNumber(),
    listPrice: game.listPrice.toNumber(),
    discountPercent: game.discountPercent,
    currency: game.currency,
    historicalLow: game.historicalLow.toNumber(),
    dealAnalysis: game.dealAnalysis
      ? {
          dealScore: game.dealAnalysis.dealScore,
          verdict: game.dealAnalysis.verdict,
          confidenceScore: game.dealAnalysis.confidenceScore,
        }
      : null,
  };
}
