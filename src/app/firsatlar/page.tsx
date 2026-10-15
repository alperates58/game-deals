import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { TrendingDown, Gamepad2, Package, Layers, Search } from "lucide-react";
import Link from "next/link";
import { ProductClass } from "@prisma/client";

export const dynamic = "force-dynamic";

interface DealsPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    sort?: string;
    minDiscount?: string;
  }>;
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const { q, type = "all", sort = "dealScore", minDiscount = "0" } = await searchParams;

  const minDiscNum = parseInt(minDiscount, 10) || 0;
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

  // Discount condition:
  // If user searched for a term (e.g. "wukong"), show all products unless minDiscount filter was explicitly set (> 0)
  if (minDiscNum > 0) {
    whereClause.discountPercent = { gte: minDiscNum };
  } else if (!hasQuery) {
    // Default deals view requires at least 1% discount
    whereClause.discountPercent = { gte: 1 };
  }

  if (hasQuery) {
    whereClause.OR = [
      { title: { contains: cleanQ, mode: "insensitive" } },
      { normalizedTitle: { contains: cleanQ, mode: "insensitive" } },
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
  } else if (hasQuery && sort === "dealScore") {
    // For search queries, prioritize on sale items, then highest popularity
    orderBy = [{ discountPercent: "desc" }, { popularityScore: "desc" }];
  }

  const deals = await prisma.game.findMany({
    where: whereClause,
    include: {
      dealAnalysis: true,
    },
    orderBy,
    take: 60,
  });

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
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
              : "Tüm Aktif Fırsatlar"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {deals.length} içerik listeleniyor {hasQuery ? "— Veritabanı arama eşleşmeleri" : "— Geçmiş fiyat analizlerine göre derecelendirilmiştir"}
          </p>
        </div>

        {/* Filter / Sort bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Category Tabs */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type: "all", sort, minDiscount: String(minDiscNum) })}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${type === "all" ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              <span>Tümü</span>
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type: "game", sort, minDiscount: String(minDiscNum) })}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${type === "game" ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Oyunlar</span>
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type: "bundle", sort, minDiscount: String(minDiscNum) })}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${type === "bundle" ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Paketler</span>
            </Link>
            <Link
              href="/eklentiler"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-blue-400 hover:text-blue-300 hover:bg-zinc-800/60"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>DLC&apos;ler</span>
            </Link>
          </div>

          {/* Quick Discount Filters */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type, sort, minDiscount: "0" })}`}
              className={`px-2 py-1 rounded-md transition-colors ${minDiscNum === 0 ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Tümü
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type, sort, minDiscount: "50" })}`}
              className={`px-2 py-1 rounded-md transition-colors ${minDiscNum === 50 ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              %50+
            </Link>
          </div>

          {/* Sort Selector Links */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type, minDiscount: String(minDiscNum), sort: "dealScore" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${sort === "dealScore" ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              En İyi Fırsat
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), type, minDiscount: String(minDiscNum), sort: "discount" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${sort === "discount" ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              En Yüksek İndirim
            </Link>
          </div>
        </div>
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
            {hasQuery ? `"${cleanQ}" için sonuç bulunamadı` : "Uygun Fırsat Bulunamadı"}
          </h3>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            {hasQuery
              ? "Aradığınız oyun veya eklenti henüz kataloğa eklenmemiş olabilir. Ürün kodunu biliyorsanız Ayarlar > Manuel Ürün Ekle alanından doğrudan veritabanına aktarabilirsiniz."
              : "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz."}
          </p>
        </div>
      )}
    </div>
  );
}
