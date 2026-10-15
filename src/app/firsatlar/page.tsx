import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { TrendingDown, Gamepad2, Search } from "lucide-react";
import { ProductClass } from "@prisma/client";
import { CatalogFilterBar } from "@/components/game/catalog-filter-bar";
import { buildReleaseDateFilter } from "@/lib/catalog/filters";

export const dynamic = "force-dynamic";

interface DealsPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    platform?: string;
    year?: string;
    sort?: string;
    minDiscount?: string;
    maxPrice?: string;
  }>;
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const {
    q,
    type = "all",
    platform = "all",
    year = "all",
    sort = "dealScore",
    minDiscount = "0",
    maxPrice = "",
  } = await searchParams;

  const minDiscNum = parseInt(minDiscount, 10) || 0;
  const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;
  const hasQuery = Boolean(q && q.trim().length > 0);
  const cleanQ = q ? q.trim() : "";

  // Category filter:
  let productClassCondition: any = undefined;
  if (type === "game") {
    productClassCondition = "BASE_GAME";
  } else if (type === "bundle") {
    productClassCondition = "BUNDLE";
  } else if (type === "addon") {
    productClassCondition = {
      in: ["DLC", "ADD_ON", "EXPANSION", "SEASON_PASS", "CONTENT_PACK"] as ProductClass[],
    };
  } else if (!hasQuery) {
    // When merely browsing deals without a search query, show games and bundles
    productClassCondition = { in: ["BASE_GAME", "BUNDLE"] as ProductClass[] };
  } else {
    // When searching, include all valid product classes except purely virtual items
    productClassCondition = {
      notIn: ["CURRENCY", "CONSUMABLE"] as ProductClass[],
    };
  }

  const whereClause: any = {
    isActive: true,
    productClass: productClassCondition,
  };

  // Platform condition (Xbox Series X|S vs Xbox One)
  if (platform === "series") {
    whereClause.platforms = { has: "XboxSeriesX" };
  } else if (platform === "one") {
    whereClause.platforms = { has: "XboxOne" };
  }

  // Release year (Yapım Yılı) condition
  const dateFilter = buildReleaseDateFilter(year);
  if (dateFilter) {
    whereClause.releaseDate = dateFilter;
  }

  // Discount condition
  if (minDiscNum > 0) {
    whereClause.discountPercent = { gte: minDiscNum };
  } else if (!hasQuery) {
    whereClause.discountPercent = { gte: 1 };
  }

  // Budget / max price condition
  if (maxPriceNum !== null && !isNaN(maxPriceNum)) {
    whereClause.currentPrice = { lte: maxPriceNum };
  }

  if (hasQuery) {
    whereClause.OR = [
      { title: { contains: cleanQ, mode: "insensitive" } },
      { normalizedTitle: { contains: cleanQ, mode: "insensitive" } },
      { publisher: { contains: cleanQ, mode: "insensitive" } },
      { franchise: { contains: cleanQ, mode: "insensitive" } },
    ];
  }

  let changedGameCount = 0;
  let orderBy: any = [{ dealAnalysis: { dealScore: "desc" } }];
  if (sort === "discount") {
    orderBy = [{ discountPercent: "desc" }];
  } else if (sort === "priceAsc") {
    orderBy = [{ currentPrice: "asc" }];
  } else if (sort === "priceDesc") {
    orderBy = [{ currentPrice: "desc" }];
  } else if (sort === "priceChange") {
    // Only query games that actually have active discounts and price history
    const changedGameRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT g.id
      FROM "Game" g
      JOIN "PriceHistory" ph ON ph."gameId" = g.id
      WHERE g."isActive" = true
        AND g."discountPercent" >= ${minDiscNum > 0 ? minDiscNum : 1}
      GROUP BY g.id
      HAVING COUNT(ph.id) >= 2
      ORDER BY MAX(ph."observedAt") DESC
      LIMIT 80
    `;
    const changedGameIds = changedGameRows.map((r) => r.id);
    changedGameCount = changedGameIds.length;
    if (changedGameIds.length >= 5) {
      whereClause.id = { in: changedGameIds };
      orderBy = [{ updatedAt: "desc" }];
    } else {
      // Graceful fallback: If fewer than 5 games have multiple price histories with active discount,
      // show all actively discounted games ordered by most recently updated
      if (!whereClause.discountPercent) {
        whereClause.discountPercent = { gt: 0 };
      }
      orderBy = [{ updatedAt: "desc" }, { discountPercent: "desc" }];
    }
  } else if (hasQuery && sort === "dealScore") {
    orderBy = [{ discountPercent: "desc" }, { popularityScore: "desc" }];
  }

  let deals = await prisma.game.findMany({
    where: whereClause,
    include: {
      dealAnalysis: true,
    },
    orderBy,
    take: 80,
  });

  // Failsafe: if sort is priceChange and returned 0 deals due to strict ID restriction, fallback cleanly
  if (deals.length === 0 && sort === "priceChange") {
    const fallbackWhere = { ...whereClause };
    delete fallbackWhere.id;
    deals = await prisma.game.findMany({
      where: fallbackWhere,
      include: {
        dealAnalysis: true,
      },
      orderBy: [{ updatedAt: "desc" }, { discountPercent: "desc" }],
      take: 80,
    });
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            {hasQuery ? <Search className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {hasQuery ? "Arama Sonuçları" : "Xbox İndirim Kataloğu"}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {hasQuery
              ? `"${cleanQ}" için Sonuçlar`
              : type === "game"
              ? "Oyun İndirimleri"
              : type === "bundle"
              ? "Paket ve Koleksiyon İndirimleri"
              : type === "addon"
              ? "DLC ve Eklenti İndirimleri"
              : sort === "priceChange"
              ? "Son Fiyatı Değişen Oyunlar"
              : "Tüm Aktif Fırsatlar"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {deals.length} içerik listeleniyor{" "}
            {platform === "series" ? "(Xbox Series X|S)" : platform === "one" ? "(Xbox One)" : ""}{" "}
            {hasQuery
              ? "— Veritabanı arama eşleşmeleri"
              : sort === "priceChange"
              ? changedGameCount > 0
                ? "— En son fiyatı değişen oyunlar"
                : "— Son güncellenen indirimli oyunlar"
              : "— Geçmiş fiyat analizlerine göre derecelendirilmiştir"}
          </p>
        </div>

        {/* Dynamic Filter Bar */}
        <CatalogFilterBar
          basePath="/firsatlar"
          filters={{ type, platform, year, minDiscount, maxPrice, sort, q: cleanQ }}
          showTypeTabs={true}
        />
      </div>

      {/* Grid */}
      {deals.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {deals.map((game) => (
            <GameCard key={game.id} {...game} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Gamepad2 className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">
            {hasQuery
              ? `"${cleanQ}" için sonuç bulunamadı`
              : "Seçilen Kriterlere Uygun Fırsat Bulunamadı"}
          </h3>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            {hasQuery
              ? "Aradığınız oyun veya eklenti henüz kataloğa eklenmemiş olabilir. Ürün kodunu biliyorsanız Ayarlar > Manuel Ürün Ekle alanından doğrudan veritabanına aktarabilirsiniz."
              : "Arama veya filtre kriterlerinizi (platform, indirim oranı, bütçe veya kategori) değiştirerek tekrar deneyebilirsiniz."}
          </p>
        </div>
      )}
    </div>
  );
}
