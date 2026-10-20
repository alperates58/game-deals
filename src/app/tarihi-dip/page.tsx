import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { Clock, Info, Award } from "lucide-react";
import { CatalogFilterBar } from "@/components/game/catalog-filter-bar";
import { CatalogPagination } from "@/components/game/catalog-pagination";
import { ProductClass } from "@prisma/client";
import { buildReleaseDateFilter } from "@/lib/catalog/filters";

export const dynamic = "force-dynamic";

interface HistoricalLowsPageProps {
  searchParams: Promise<{
    type?: string;
    platform?: string;
    year?: string;
    minDiscount?: string;
    maxPrice?: string;
    sort?: string;
    q?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 48;

export default async function HistoricalLowsPage({ searchParams }: HistoricalLowsPageProps) {
  const {
    type = "all",
    platform = "all",
    year = "all",
    minDiscount = "0",
    maxPrice = "",
    sort = "dealScore",
    q = "",
    page = "1",
  } = await searchParams;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const minDiscNum = parseInt(minDiscount, 10) || 0;
  const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;
  const cleanQ = q.trim();

  // Authoritative SQL condition: Only games whose current price is at or below historical low
  const lowIdsRaw = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Game"
    WHERE "isActive" = true AND "isPlatformVariant" = false AND "discountPercent" > 0 AND "currentPrice" <= "historicalLow"
  `;
  const lowIds = lowIdsRaw.map((r) => r.id);

  let productClassCondition: any = undefined;
  if (type === "game") {
    productClassCondition = "BASE_GAME";
  } else if (type === "bundle") {
    productClassCondition = "BUNDLE";
  } else if (type === "addon") {
    productClassCondition = {
      in: ["DLC", "ADD_ON", "EXPANSION", "SEASON_PASS", "CONTENT_PACK"] as ProductClass[],
    };
  }

  const whereClause: any = {
    id: { in: lowIds },
    isActive: true,
    isPlatformVariant: false,
    discountPercent: { gt: 0 },
  };

  // Platform condition (Xbox Series X|S vs Xbox One vs PC)
  if (platform === "series") {
    whereClause.platforms = { has: "XboxSeriesX" };
  } else if (platform === "one") {
    whereClause.platforms = { has: "XboxOne" };
  } else if (platform === "pc") {
    whereClause.platforms = { has: "PC" };
  }

  // Release year (Yapım Yılı) condition
  const dateFilter = buildReleaseDateFilter(year);
  if (dateFilter) {
    whereClause.releaseDate = dateFilter;
  }

  if (productClassCondition) {
    whereClause.productClass = productClassCondition;
  }

  if (minDiscNum > 0) {
    whereClause.discountPercent = { gte: minDiscNum };
  }

  if (maxPriceNum !== null && !isNaN(maxPriceNum)) {
    whereClause.currentPrice = { lte: maxPriceNum };
  }

  if (cleanQ) {
    whereClause.OR = [
      { title: { contains: cleanQ, mode: "insensitive" } },
      { publisher: { contains: cleanQ, mode: "insensitive" } },
      { franchise: { contains: cleanQ, mode: "insensitive" } },
    ];
  }

  let orderBy: any = [{ dealAnalysis: { dealScore: "desc" } }];
  if (sort === "discount") {
    orderBy = [{ discountPercent: "desc" }];
  } else if (sort === "priceAsc") {
    orderBy = [{ currentPrice: "asc" }];
  } else if (sort === "priceDesc") {
    orderBy = [{ currentPrice: "desc" }];
  } else if (sort === "priceChange") {
    orderBy = [{ updatedAt: "desc" }];
  }

  const [totalCount, verifiedLows] = await Promise.all([
    prisma.game.count({ where: whereClause }),
    prisma.game.findMany({
      where: whereClause,
      include: {
        dealAnalysis: true,
      },
      orderBy,
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Clock className="h-4 w-4" />
            Tarihi Fiyat Rekorları
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Takip Başladığından Beri En Düşük Fiyattakiler
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            <span className="font-semibold text-amber-400">{totalCount.toLocaleString("tr-TR")}</span> içerik listeleniyor{" "}
            {platform === "series" ? "(Xbox Series X|S)" : platform === "one" ? "(Xbox One)" : ""}{" "}
            {totalPages > 1 ? `— Sayfa ${currentPage} / ${totalPages} ` : ""}
            — Sistemimizin takibe aldığı tarihten bu yana gördüğü en düşük fiyatta olan oyunlar ve eklentiler.
          </p>
        </div>

        {/* Truthful UI Banner */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200/90">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Dürüst Veri İlkesi:</strong> &ldquo;Tarihi Dip&rdquo;, sistemimizin bu oyunu ilk gözlemlediği tarihten itibaren geçerlidir. Oyunun sistemimiz kurulmadan önceki yıllara ait indirimi varsa bu veride yer almaz; varsayım yapılmaz.
          </span>
        </div>

        {/* Dynamic Filter Bar */}
        <CatalogFilterBar
          basePath="/tarihi-dip"
          filters={{ type, platform, year, minDiscount, maxPrice, sort, q: cleanQ }}
          showTypeTabs={true}
        />
      </div>

      {/* Grid */}
      {verifiedLows.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {verifiedLows.map((game) => (
              <GameCard key={game.id} {...game} />
            ))}
          </div>

          {/* Pagination */}
          <CatalogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            basePath="/tarihi-dip"
            searchParams={{
              type,
              platform,
              year,
              minDiscount,
              maxPrice,
              sort,
              q: cleanQ,
            }}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Award className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-base font-semibold text-zinc-300">Seçilen Filtrelere Uygun Tarihi Dip Fırsatı Bulunamadı</p>
          <p className="mt-1 text-xs text-zinc-400">
            Filtreleme kriterlerinizi (platform, indirim oranı, bütçe veya içerik türü) değiştirerek tekrar deneyebilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
