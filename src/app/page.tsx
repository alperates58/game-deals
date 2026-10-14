import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { Sparkles, TrendingDown, Clock, ShieldCheck, Flame, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

async function getHomePageData() {
  const [
    totalGames,
    activeDealsCount,
    lastSync,
    bestDeals,
    historicalLows,
    popularGames,
  ] = await Promise.all([
    prisma.game.count({ where: { isActive: true } }),
    prisma.game.count({ where: { isActive: true, discountPercent: { gt: 0 } } }),
    prisma.syncRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.game.findMany({
      where: {
        isActive: true,
        discountPercent: { gt: 0 },
      },
      include: {
        dealAnalysis: true,
      },
      orderBy: [
        { dealAnalysis: { dealScore: "desc" } },
        { discountPercent: "desc" },
      ],
      take: 8,
    }),
    prisma.game.findMany({
      where: {
        isActive: true,
        discountPercent: { gt: 0 },
      },
      include: {
        dealAnalysis: true,
      },
      orderBy: [
        { historicalLowAt: "desc" },
        { discountPercent: "desc" },
      ],
      take: 8,
    }),
    prisma.game.findMany({
      where: {
        isActive: true,
        isCore: true,
      },
      include: {
        dealAnalysis: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  // Filter historical lows truthfully where currentPrice <= historicalLow
  const verifiedLows = historicalLows.filter(
    (g) => g.currentPrice.toNumber() <= g.historicalLow.toNumber()
  );

  return {
    totalGames,
    activeDealsCount,
    lastSyncAt: lastSync?.finishedAt || null,
    bestDeals,
    verifiedLows,
    popularGames,
  };
}

import { FeaturedDealsSlider, FeaturedDealItem } from "@/components/home/featured-deals-slider";

export default async function HomePage() {
  const data = await getHomePageData();

  const featuredSliderDeals: FeaturedDealItem[] = data.bestDeals.slice(0, 6).map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    publisher: g.publisher,
    imageUrl: g.imageUrl,
    screenshots: (g.screenshots as string[]) || [],
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Section: Compact Brand Value + Featured Deals Slider */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Compact Brand Card */}
        <div className="lg:col-span-5 flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 via-zinc-900/40 to-zinc-950 p-6 sm:p-7 relative shadow-xl">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-400 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Xbox Türkiye Gerçek Fırsat Motoru
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-snug">
              Sahte indirimlere kanmayın. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
                Gerçek fırsatları takip edin.
              </span>
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Microsoft Store Türkiye&apos;deki ücretli oyunların gerçek fiyat geçmişini kaydediyor,
              mağazanın şişirilmiş indirim oranını değil daha önceki dip fiyatları referans alarak analiz ediyoruz.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-4">
            <div className="rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70">
              <p className="text-xl font-black text-white">{data.totalGames}</p>
              <p className="text-[11px] text-zinc-400 font-medium">Takip Edilen Oyun</p>
            </div>
            <div className="rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70">
              <p className="text-xl font-black text-emerald-400">%{Math.round((data.activeDealsCount / (data.totalGames || 1)) * 100)}</p>
              <p className="text-[11px] text-zinc-400 font-medium">{data.activeDealsCount} Aktif İndirim</p>
            </div>
            <div className="rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70">
              <p className="text-xl font-black text-amber-400">{data.verifiedLows.length}</p>
              <p className="text-[11px] text-zinc-400 font-medium">Tarihi Dip Fiyatta</p>
            </div>
            <div className="rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70">
              <p className="text-xs font-semibold text-zinc-200 mt-1">
                {data.lastSyncAt
                  ? new Date(data.lastSyncAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                  : "Bugün"}
              </p>
              <p className="text-[11px] text-zinc-400 font-medium">Son Güncelleme</p>
            </div>
          </div>
        </div>

        {/* Right Column: Featured Deals Slider */}
        <div className="lg:col-span-7 flex flex-col">
          <FeaturedDealsSlider deals={featuredSliderDeals} />
        </div>
      </section>

      {/* Section 1: Best Deals */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Öne Çıkan Gerçek Fırsatlar</h2>
              <p className="text-xs text-zinc-400">
                Fırsat analiz puanı en yüksek, dip fiyatına en yakın indirimler
              </p>
            </div>
          </div>
          <Link
            href="/firsatlar"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Tümünü Gör
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {data.bestDeals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {data.bestDeals.map((game) => (
              <GameCard key={game.id} {...game} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
            Şu anda aktif indirimde oyun bulunamadı veya senkronizasyon devam ediyor.
          </div>
        )}
      </section>

      {/* Section 2: Historical Lows */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Takip Başladığından Beri En Düşük Fiyat
              </h2>
              <p className="text-xs text-zinc-400">
                Sistemimiz takibe aldığından beri bu fiyata hiç inmemiş oyunlar
              </p>
            </div>
          </div>
          <Link
            href="/tarihi-dip"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Tümünü Gör
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {data.verifiedLows.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {data.verifiedLows.map((game) => (
              <GameCard key={game.id} {...game} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
            Tarihi dip fiyatta olan oyunlar listeleniyor.
          </div>
        )}
      </section>

      {/* Section 3: Popular Core Games */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Popüler Seriler ve Klasikler</h2>
              <p className="text-xs text-zinc-400">
                GTA, Cyberpunk, Forza, Assassin&apos;s Creed gibi 32 ana seriden seçkiler
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {data.popularGames.map((game) => (
            <GameCard key={game.id} {...game} />
          ))}
        </div>
      </section>
    </div>
  );
}
