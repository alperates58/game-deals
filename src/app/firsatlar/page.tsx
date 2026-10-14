import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { TrendingDown, Filter } from "lucide-react";
import Link from "next/link";

export const revalidate = 60;

interface DealsPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    minDiscount?: string;
  }>;
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const { q, sort = "dealScore", minDiscount = "0" } = await searchParams;

  const minDiscNum = parseInt(minDiscount, 10) || 0;

  const whereClause: any = {
    isActive: true,
    discountPercent: { gte: Math.max(1, minDiscNum) },
  };

  if (q && q.trim().length > 0) {
    whereClause.OR = [
      { title: { contains: q.trim(), mode: "insensitive" } },
      { publisher: { contains: q.trim(), mode: "insensitive" } },
      { franchise: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  let orderBy: any = [{ dealAnalysis: { dealScore: "desc" } }];
  if (sort === "discount") {
    orderBy = [{ discountPercent: "desc" }];
  } else if (sort === "priceAsc") {
    orderBy = [{ currentPrice: "asc" }];
  } else if (sort === "priceDesc") {
    orderBy = [{ currentPrice: "desc" }];
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <TrendingDown className="h-4 w-4" />
            Xbox İndirim Kataloğu
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Tüm Aktif Fırsatlar
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {deals.length} oyun listeleniyor — Geçmiş fiyat analizlerine göre derecelendirilmiştir
          </p>
        </div>

        {/* Filter / Sort bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Discount Filters */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), sort, minDiscount: "0" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${minDiscNum === 0 ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Tümü
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), sort, minDiscount: "25" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${minDiscNum === 25 ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              %25+
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), sort, minDiscount: "50" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${minDiscNum === 50 ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              %50+
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), sort, minDiscount: "75" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${minDiscNum === 75 ? "bg-emerald-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              %75+
            </Link>
          </div>

          {/* Sort Selector Links */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), minDiscount: String(minDiscNum), sort: "dealScore" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${sort === "dealScore" ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              En İyi Fırsat
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), minDiscount: String(minDiscNum), sort: "discount" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${sort === "discount" ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              En Yüksek İndirim
            </Link>
            <Link
              href={`/firsatlar?${new URLSearchParams({ ...(q ? { q } : {}), minDiscount: String(minDiscNum), sort: "priceAsc" })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${sort === "priceAsc" ? "bg-zinc-800 text-emerald-400 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Fiyat: Artan
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-base font-semibold text-zinc-300">Uygun Fırsat Bulunamadı</p>
          <p className="mt-1 text-xs text-zinc-400">
            Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
