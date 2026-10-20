import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { FeaturedDealsSlider, FeaturedDealItem } from "@/components/home/featured-deals-slider";
import { DealsCarousel, CarouselGameItem } from "@/components/home/deals-carousel";
import { formatPrice } from "@/lib/formatters";
import {
  getHomepageConfig,
  fetchHeroSliderGames,
  fetchSectionGames,
  HomepageSectionConfig,
} from "@/lib/settings/homepage-config";
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
  Package,
  Gift,
  Tv,
} from "lucide-react";

export const dynamic = "force-dynamic";

function getSectionIcon(iconName: string) {
  switch (iconName) {
    case "flame":
      return <Flame className="h-4 w-4" />;
    case "trending-down":
      return <TrendingDown className="h-4 w-4" />;
    case "sparkles":
      return <Sparkles className="h-4 w-4" />;
    case "dollar-sign":
      return <DollarSign className="h-4 w-4" />;
    case "package":
      return <Package className="h-4 w-4" />;
    case "award":
      return <Award className="h-4 w-4" />;
    case "gamepad":
      return <Gamepad2 className="h-4 w-4" />;
    case "monitor":
      return <Tv className="h-4 w-4" />;
    case "tag":
      return <Tag className="h-4 w-4" />;
    case "gift":
      return <Gift className="h-4 w-4" />;
    default:
      return <Flame className="h-4 w-4" />;
  }
}

function getSectionIconStyle(iconName: string, customStyle?: string) {
  if (customStyle) return customStyle;
  switch (iconName) {
    case "flame":
      return "bg-rose-950 border-rose-500/40 text-rose-400";
    case "trending-down":
      return "bg-emerald-950 border-emerald-500/40 text-emerald-400";
    case "sparkles":
      return "bg-cyan-950 border-cyan-500/40 text-cyan-400";
    case "dollar-sign":
      return "bg-amber-950 border-amber-500/40 text-amber-400";
    case "package":
      return "bg-purple-950 border-purple-500/40 text-purple-400";
    case "award":
      return "bg-blue-950 border-blue-500/40 text-blue-400";
    default:
      return "bg-emerald-950 border-emerald-500/40 text-emerald-400";
  }
}

export default async function HomePage() {
  // 1. Load active homepage configuration
  const homepageConfig = await getHomepageConfig();

  // 2. Fetch base platform metrics and hero slider in parallel
  const [
    totalGames,
    activeDealsCount,
    lastSync,
    totalHistoricalLowsRaw,
    totalBundlesCount,
    sliderGames,
    recentDropsRaw,
  ] = await Promise.all([
    prisma.game.count({ where: { isActive: true, isPlatformVariant: false } }),
    prisma.game.count({ where: { isActive: true, isPlatformVariant: false, discountPercent: { gt: 0 } } }),
    prisma.syncRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int as count FROM "Game"
      WHERE "isActive" = true AND "isPlatformVariant" = false AND "discountPercent" > 0 AND "currentPrice" <= "historicalLow"
    `.catch(() => [{ count: 0 }]),
    prisma.game.count({
      where: {
        isActive: true,
        isPlatformVariant: false,
        productClass: "BUNDLE",
        discountPercent: { gt: 0 },
      },
    }),
    fetchHeroSliderGames(homepageConfig.heroSlider),
    // Secondary slider tab items (recent drops or top historical lows)
    fetchSectionGames({
      id: "slider-tab-drops",
      enabled: true,
      order: 99,
      title: "Yeni Fiyatı Düşenler",
      subtitle: "",
      badgeText: "",
      icon: "sparkles",
      queryType: "PRICE_DROPS",
      platform: homepageConfig.heroSlider.platform,
      productClass: "ALL",
      sortBy: "RECENT_DROPS",
      limit: 10,
    }),
  ]);

  const totalHistoricalLowsCount = Number(totalHistoricalLowsRaw[0]?.count || 0);

  // 3. Dynamically fetch games for all enabled sections in user-defined order
  const activeSections = homepageConfig.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const sectionResults = await Promise.all(
    activeSections.map(async (sec) => {
      const games = await fetchSectionGames(sec);
      return { section: sec, games };
    })
  );

  // Secondary tab fallback for hero slider
  const sliderRecentDrops: FeaturedDealItem[] = recentDropsRaw.map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    publisher: g.publisher,
    imageUrl: g.imageUrl,
    screenshots: [],
    currentPrice: g.currentPrice,
    listPrice: g.listPrice,
    discountPercent: g.discountPercent,
    currency: g.currency,
    historicalLow: g.historicalLow,
    dealAnalysis: g.dealAnalysis
      ? {
          dealScore: g.dealAnalysis.dealScore,
          verdict: g.dealAnalysis.verdict,
        }
      : null,
  }));

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-12 sm:space-y-14 overflow-x-hidden">
      {/* Hero Section: Compact Brand Value + Featured Deals Slider */}
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
            <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md">
              Xbox Store&apos;daki fiyat oyunlarını ve bindirimleri yapay zekâ analizimizle eliyoruz.
              Gerçek dip fiyatlar, derin indirimler ve uyumlu platformlar burada.
            </p>
          </div>

          {/* 4 Key Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-6 relative z-10">
            {/* Metric 1: Aktif Fırsatlar */}
            <Link
              href="/firsatlar"
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3 sm:p-3.5 hover:border-emerald-500/50 hover:bg-zinc-800/60 transition-all group/card shadow-sm block"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg sm:text-xl font-extrabold text-white group-hover/card:text-emerald-400 transition-colors">
                  {activeDealsCount.toLocaleString("tr-TR")}
                </span>
                <Flame className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Aktif İndirim</p>
            </Link>

            {/* Metric 2: Tarihi Dipte Olanlar */}
            <Link
              href="/tarihi-dip"
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3 sm:p-3.5 hover:border-amber-500/50 hover:bg-zinc-800/60 transition-all group/card shadow-sm block"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg sm:text-xl font-extrabold text-white group-hover/card:text-amber-400 transition-colors">
                  {totalHistoricalLowsCount.toLocaleString("tr-TR")}
                </span>
                <Award className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Tarihi Dip Fiyatta</p>
            </Link>

            {/* Metric 3: İndirimli Paketler */}
            <Link
              href="/eklentiler"
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3 sm:p-3.5 hover:border-purple-500/50 hover:bg-zinc-800/60 transition-all group/card shadow-sm block"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg sm:text-xl font-extrabold text-white group-hover/card:text-purple-400 transition-colors">
                  {totalBundlesCount.toLocaleString("tr-TR")}
                </span>
                <Package className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Paket & Koleksiyon</p>
            </Link>

            {/* Metric 4: Son Eşitleme Saati */}
            <Link
              href="/firsatlar?sort=recent"
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3 sm:p-3.5 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all group/card shadow-sm block"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm sm:text-base font-bold text-zinc-200">
                  {lastSync?.finishedAt
                    ? new Intl.DateTimeFormat("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Istanbul",
                      }).format(new Date(lastSync.finishedAt))
                    : "Bugün"}
                </p>
                <Activity className="h-3 w-3 text-zinc-500 group-hover/card:text-zinc-300 transition-colors" />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Son Güncelleme</p>
            </Link>
          </div>
        </div>

        {/* Right Column: Hero Slider */}
        <div className="lg:col-span-7 flex flex-col">
          {homepageConfig.heroSlider.enabled && sliderGames.length > 0 ? (
            <FeaturedDealsSlider
              topDeals={sliderGames}
              recentDrops={sliderRecentDrops.length > 0 ? sliderRecentDrops : undefined}
              dropTabLabel={sliderRecentDrops.length > 0 ? "Yeni Fiyatı Düşenler" : undefined}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8 border border-zinc-800 bg-zinc-900/40 rounded-2xl text-center text-zinc-400 text-sm">
              Hero Slider vitrini pasif durumdadır. Admin panelinden aktif edebilirsiniz.
            </div>
          )}
        </div>
      </section>

      {/* DYNAMIC HOMEPAGE VITRIN SECTIONS */}
      {sectionResults.map(({ section, games }) => {
        if (!games || games.length === 0) return null;

        const iconNode = getSectionIcon(section.icon);
        const iconStyle = getSectionIconStyle(section.icon, section.iconStyle);
        const seeAllText = section.badgeText
          ? `${section.badgeText} (${games.length})`
          : `Tümünü Gör (${games.length})`;

        // Build effective seeAllHref with platform if set
        let seeAllHref = section.viewAllUrl || "/firsatlar";
        if (section.platform && section.platform !== "ALL" && !seeAllHref.includes("platform=")) {
          const sep = seeAllHref.includes("?") ? "&" : "?";
          seeAllHref = `${seeAllHref}${sep}platform=${section.platform}`;
        }

        return (
          <DealsCarousel
            key={section.id}
            title={section.title}
            subtitle={section.subtitle}
            icon={iconNode}
            iconStyle={iconStyle}
            seeAllHref={seeAllHref}
            seeAllText={seeAllText}
            games={games}
            highlightBadge={section.highlightBadge}
          />
        );
      })}
    </div>
  );
}
