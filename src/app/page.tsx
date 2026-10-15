import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { FeaturedDealsSlider, FeaturedDealItem } from "@/components/home/featured-deals-slider";
import { DealsCarousel, CarouselGameItem } from "@/components/home/deals-carousel";
import { formatPrice } from "@/lib/formatters";
import {
  Sparkles,
  TrendingDown,
  Clock,
  Flame,
  ChevronRight,
  Award,
  Layers,
  Tag,
  Gamepad2,
  DollarSign,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getHomePageData() {
  const [
    totalGames,
    activeDealsCount,
    lastSync,
    bestDeals,
    historicalLows,
    popularGames,
    under150Deals,
    recentPriceChanges,
    totalHistoricalLowsRaw,
  ] = await Promise.all([
    prisma.game.count({ where: { isActive: true } }),
    prisma.game.count({ where: { isActive: true, discountPercent: { gt: 0 } } }),
    prisma.syncRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
    }),
    // 12 Top deals for Hero Slider
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
      take: 12,
    }),
    // Historical Lows (Truthful)
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
      take: 30,
    }),
    // Popular Core Games
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
    // Under 150 TL Deals (Budget Gems)
    prisma.game.findMany({
      where: {
        isActive: true,
        discountPercent: { gte: 25 },
        currentPrice: { lte: 150, gt: 0 },
      },
      include: {
        dealAnalysis: true,
      },
      orderBy: [
        { discountPercent: "desc" },
        { dealAnalysis: { dealScore: "desc" } },
      ],
      take: 15,
    }),
    // Recent Price Changes / Updates
    prisma.game.findMany({
      where: {
        isActive: true,
        discountPercent: { gt: 0 },
      },
      include: {
        dealAnalysis: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 15,
    }),
    // True dynamic count of all games currently at historical low
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int as count FROM "Game"
      WHERE "isActive" = true AND "discountPercent" > 0 AND "currentPrice" <= "historicalLow"
    `,
  ]);

  // Filter historical lows truthfully where currentPrice <= historicalLow
  const verifiedLows = historicalLows
    .filter((g) => g.currentPrice.toNumber() <= g.historicalLow.toNumber())
    .slice(0, 15);

  const totalHistoricalLowsCount = Number(totalHistoricalLowsRaw[0]?.count || 0);

  return {
    totalGames,
    activeDealsCount,
    totalHistoricalLowsCount,
    lastSyncAt: lastSync?.finishedAt || null,
    bestDeals,
    verifiedLows,
    popularGames,
    under150Deals,
    recentPriceChanges,
  };
}

function mapToCarouselItem(g: any): CarouselGameItem {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    publisher: g.publisher,
    imageUrl: g.imageUrl,
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
  };
}

export default async function HomePage() {
  const data = await getHomePageData();

  const featuredSliderDeals: FeaturedDealItem[] = data.bestDeals.map((g) => ({
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

  const historicalLowCarouselItems = data.verifiedLows.map(mapToCarouselItem);
  const recentChangesCarouselItems = data.recentPriceChanges.map(mapToCarouselItem);
  const under150CarouselItems = data.under150Deals.map(mapToCarouselItem);

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-12 sm:space-y-14 overflow-x-hidden">
      {/* Hero Section: Compact Brand Value + 12-Deal Hero Slider */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Brand Card + 4 Interactive Clickable Metrics */}
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
              Microsoft Store Türkiye&apos;deki tüm Series X|S oyunlarının gerçek fiyat geçmişini kaydediyor,
              mağazanın şişirilmiş indirim oranını değil daha önceki dip fiyatları referans alıyoruz.
            </p>
          </div>

          {/* 4 Interactive Clickable Metrics Cards */}
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-4">
            {/* 1. Takip Edilen Oyun -> Links to /firsatlar?type=all */}
            <Link
              href="/firsatlar?type=all"
              className="group/card rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70 hover:border-emerald-500/50 hover:bg-zinc-850/80 transition-all block"
              title="Katalogdaki tüm oyunları listele"
            >
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-white group-hover/card:text-emerald-300 transition-colors">
                  {formatPrice(data.totalGames)}
                </p>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover/card:text-emerald-400 transition-colors" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Takip Edilen Oyun</p>
            </Link>

            {/* 2. Aktif İndirim -> Links to /firsatlar */}
            <Link
              href="/firsatlar"
              className="group/card rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70 hover:border-emerald-500/50 hover:bg-zinc-850/80 transition-all block"
              title="Tüm indirimleri listele"
            >
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-emerald-400 group-hover/card:text-emerald-300 transition-colors">
                  {formatPrice(data.activeDealsCount)}
                </p>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover/card:text-emerald-400 transition-colors" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5 flex items-center justify-between">
                <span>Aktif İndirim</span>
                <span className="text-[10px] text-zinc-500 font-normal">Kataloğun %{Math.round((data.activeDealsCount / (data.totalGames || 1)) * 100)}'u</span>
              </p>
            </Link>

            {/* 3. Tarihi Dip Fiyatta -> Links to /tarihi-dip (Dinamik ve Tıklanabilir!) */}
            <Link
              href="/tarihi-dip"
              className="group/card rounded-xl bg-zinc-900/60 p-3 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20 transition-all block shadow-sm"
              title="Tarihi dip fiyattaki tüm oyunları aç"
            >
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-amber-400 group-hover/card:text-amber-300 transition-colors">
                  {formatPrice(data.totalHistoricalLowsCount)}
                </p>
                <Award className="h-3.5 w-3.5 text-amber-400 group-hover/card:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-zinc-300 font-medium mt-0.5 flex items-center gap-1">
                <span>Tarihi Dip Fiyatta</span>
                <span className="text-amber-400 text-[10px]">→</span>
              </p>
            </Link>

            {/* 4. Son Güncelleme -> Links to /ayarlar */}
            <Link
              href="/ayarlar"
              className="group/card rounded-xl bg-zinc-900/60 p-3 border border-zinc-800/70 hover:border-zinc-600 hover:bg-zinc-850/80 transition-all block"
              title="Sistem durumu ve son tarama geçmişi"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-200 mt-1" suppressHydrationWarning>
                  {data.lastSyncAt
                    ? new Date(data.lastSyncAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                    : "Bugün"}
                </p>
                <Activity className="h-3 w-3 text-zinc-500 group-hover/card:text-zinc-300 transition-colors" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Son Güncelleme</p>
            </Link>
          </div>
        </div>

        {/* Right Column: 12-Game Featured Deals Slider */}
        <div className="lg:col-span-7 flex flex-col">
          <FeaturedDealsSlider deals={featuredSliderDeals} />
        </div>
      </section>

      {/* Slider Carousel 1: 🔥 Tarihi Dip Fırsatları Vitrini */}
      {historicalLowCarouselItems.length > 0 && (
        <DealsCarousel
          title="Tarihi Dip Fırsatları Vitrini"
          subtitle="Sistemimizin gözlemlediği en düşük fiyata inen oyunlar ve eklentiler"
          icon={<Award className="h-4 w-4" />}
          iconStyle="bg-amber-950 border-amber-500/40 text-amber-400"
          seeAllHref="/tarihi-dip"
          seeAllText={`Tümünü Gör (${data.totalHistoricalLowsCount})`}
          games={historicalLowCarouselItems}
          highlightBadge="historicalLow"
        />
      )}

      {/* Slider Carousel 2: 📉 Son Fiyatı Düşenler & Değişenler Vitrini */}
      {recentChangesCarouselItems.length > 0 && (
        <DealsCarousel
          title="Son Fiyatı Düşenler & Değişenler"
          subtitle="En son katalog taramasında fiyatı güncellenen veya yeni indirime giren oyunlar"
          icon={<Clock className="h-4 w-4" />}
          iconStyle="bg-blue-950 border-blue-500/40 text-blue-400"
          seeAllHref="/firsatlar?sort=priceChange"
          seeAllText="Fiyatı Değişenleri Gör"
          games={recentChangesCarouselItems}
        />
      )}

      {/* Slider Carousel 3: 💰 150 TL Altı Kelepir Fırsatlar Vitrini */}
      {under150CarouselItems.length > 0 && (
        <DealsCarousel
          title="150 TL Altı Efsane Fırsatlar"
          subtitle="Yüksek indirimli, bütçe dostu kütüphane dolduran Xbox fırsatları"
          icon={<DollarSign className="h-4 w-4" />}
          iconStyle="bg-emerald-950 border-emerald-500/40 text-emerald-400"
          seeAllHref="/firsatlar?maxPrice=150&minDiscount=50"
          seeAllText="Bütçe Fırsatları"
          games={under150CarouselItems}
          highlightBadge="budget"
        />
      )}

      {/* Section 4: Popüler Seriler ve Klasikler (Grid View) */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200">
              <Gamepad2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Popüler Seriler ve Klasikler</h2>
              <p className="text-xs text-zinc-400">
                GTA, Cyberpunk, Forza, Assassin&apos;s Creed gibi büyük serilerden seçkiler
              </p>
            </div>
          </div>
          <Link
            href="/firsatlar?type=game"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Tüm Oyunlar</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
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
