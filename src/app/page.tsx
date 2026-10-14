import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { Sparkles, TrendingDown, Clock, ShieldCheck, Flame, ChevronRight } from "lucide-react";

export const revalidate = 60; // ISR cache 60s

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

export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 via-zinc-900/40 to-zinc-950 p-6 sm:p-10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Xbox Türkiye Gerçek Fırsat Analiz Motoru
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Sahte indirimlere kanmayın. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
              Gerçek fırsatları takip edin.
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl">
            Microsoft Store Türkiye&apos;deki ücretli oyunların gerçek fiyat geçmişini kaydediyor,
            mağazanın indirim oranını değil, daha önceki dip fiyatları referans alarak analiz ediyoruz.
          </p>

          {/* Key Metrics */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-zinc-800/80 pt-6">
            <div>
              <p className="text-2xl font-black text-white">{data.totalGames}</p>
              <p className="text-xs text-zinc-400 font-medium">Takip Edilen Oyun</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">%{Math.round((data.activeDealsCount / (data.totalGames || 1)) * 100)}</p>
              <p className="text-xs text-zinc-400 font-medium">{data.activeDealsCount} Aktif İndirim</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-400">{data.verifiedLows.length}</p>
              <p className="text-xs text-zinc-400 font-medium">Tarihi Dip Fiyatta</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200 mt-1">
                {data.lastSyncAt
                  ? new Date(data.lastSyncAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                  : "Bugün"}
              </p>
              <p className="text-xs text-zinc-400 font-medium">Son Güncelleme</p>
            </div>
          </div>
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
