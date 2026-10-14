import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { ProductClass } from "@prisma/client";

export const dynamic = "force-dynamic";

interface AddonsPageProps {
  searchParams: Promise<{
    q?: string;
    class?: string;
    sort?: string;
    minDiscount?: string;
  }>;
}

export default async function AddonsPage({ searchParams }: AddonsPageProps) {
  const { q, class: classFilter, sort = "discount", minDiscount = "0" } = await searchParams;

  const minDiscNum = parseInt(minDiscount, 10) || 0;

  // Allowed add-on product classes
  const allowedAddonClasses: ProductClass[] = [
    "DLC",
    "ADD_ON",
    "EXPANSION",
    "SEASON_PASS",
    "CONTENT_PACK",
  ];

  const whereClause: any = {
    isActive: true,
    productClass: classFilter && allowedAddonClasses.includes(classFilter as any)
      ? (classFilter as ProductClass)
      : { in: allowedAddonClasses },
    discountPercent: { gte: minDiscNum },
  };

  if (q && q.trim().length > 0) {
    whereClause.OR = [
      { title: { contains: q.trim(), mode: "insensitive" } },
      { publisher: { contains: q.trim(), mode: "insensitive" } },
      { franchise: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  let orderBy: any = [{ discountPercent: "desc" }];
  if (sort === "dealScore") {
    orderBy = [{ dealAnalysis: { dealScore: "desc" } }];
  } else if (sort === "priceAsc") {
    orderBy = [{ currentPrice: "asc" }];
  } else if (sort === "priceDesc") {
    orderBy = [{ currentPrice: "desc" }];
  }

  const addons = await prisma.game.findMany({
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
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Layers className="h-4 w-4" />
            Xbox Eklenti ve DLC Pazarı
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            DLC & Eklentiler
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Genişletme paketleri, sezon biletleri ve ek içerikler ({addons.length} içerik)
          </p>
        </div>

        {/* Subtype tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/eklentiler?${new URLSearchParams({ ...(q ? { q } : {}), sort, minDiscount: String(minDiscNum) })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${!classFilter ? "bg-blue-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Tüm Eklentiler
            </Link>
            <Link
              href={`/eklentiler?${new URLSearchParams({ ...(q ? { q } : {}), class: "DLC", sort, minDiscount: String(minDiscNum) })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${classFilter === "DLC" ? "bg-blue-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              DLC
            </Link>
            <Link
              href={`/eklentiler?${new URLSearchParams({ ...(q ? { q } : {}), class: "EXPANSION", sort, minDiscount: String(minDiscNum) })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${classFilter === "EXPANSION" ? "bg-blue-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Genişletme
            </Link>
            <Link
              href={`/eklentiler?${new URLSearchParams({ ...(q ? { q } : {}), class: "SEASON_PASS", sort, minDiscount: String(minDiscNum) })}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${classFilter === "SEASON_PASS" ? "bg-blue-600 text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Sezon Bileti
            </Link>
          </div>

          {/* Quick Discount Filters */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            <Link
              href={`/eklentiler?${new URLSearchParams({ ...(q ? { q } : {}), ...(classFilter ? { class: classFilter } : {}), sort, minDiscount: "0" })}`}
              className={`px-2 py-1 rounded-md transition-colors ${minDiscNum === 0 ? "bg-zinc-800 text-blue-300 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              Tüm Fiyatlar
            </Link>
            <Link
              href={`/eklentiler?${new URLSearchParams({ ...(q ? { q } : {}), ...(classFilter ? { class: classFilter } : {}), sort, minDiscount: "50" })}`}
              className={`px-2 py-1 rounded-md transition-colors ${minDiscNum === 50 ? "bg-zinc-800 text-blue-300 font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              %50+ İndirim
            </Link>
          </div>
        </div>
      </div>

      {/* Grid */}
      {addons.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {addons.map((addon) => (
            <GameCard key={addon.id} {...addon} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-base font-semibold text-zinc-300">Uygun Eklenti Bulunamadı</p>
          <p className="mt-1 text-xs text-zinc-400">
            Filtreleme kriterlerinizi değiştirerek tekrar deneyebilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
