import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { GameActions } from "@/components/game/game-actions";
import { RelationType, ProductClass } from "@prisma/client";
import { KNOWN_BUNDLE_CHILDREN } from "@/lib/xbox/mapper";
import {
  enrichBundleChildrenFromCatalog,
  BUNDLE_RELATION_SOURCE_V2,
} from "@/lib/xbox/bundle-enricher";
import { DealBadge, ConfidenceBadge } from "@/components/game/deal-badge";
import { PriceHistoryChart } from "@/components/game/price-history-chart";
import { XboxStoreActions } from "@/components/game/xbox-store-button";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";
import { formatDate, formatDateTime, formatPrice } from "@/lib/formatters";
import {
  ExternalLink,
  ShieldCheck,
  Clock,
  Tag,
  Gamepad2,
  Calendar,
  Building,
  TrendingDown,
  Info,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

const CLASS_LABELS: Record<ProductClass, { label: string; color: string }> = {
  BASE_GAME: { label: "Ana Oyun", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  BUNDLE: { label: "Paket / Koleksiyon", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  DLC: { label: "DLC", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  EXPANSION: { label: "Genişletme Paketi", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  SEASON_PASS: { label: "Sezon Bileti", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  CONTENT_PACK: { label: "İçerik Paketi", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  ADD_ON: { label: "Eklenti", color: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  CURRENCY: { label: "Oyun Parası", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  CONSUMABLE: { label: "Tüketilebilir", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  UNKNOWN: { label: "Katalog Öğesi", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
};

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await prisma.game.findUnique({
    where: { slug },
    select: { title: true, currentPrice: true, discountPercent: true },
  });

  if (!game) {
    return { title: "Oyun Bulunamadı | Xbox Fırsat" };
  }

  const discountText = game.discountPercent > 0 ? `(%${game.discountPercent} İndirim)` : "";
  return {
    title: `${game.title} Fiyat Geçmişi ve İndirim Analizi ${discountText} | Xbox Fırsat`,
    description: `${game.title} için Xbox Türkiye mağazasında tespit edilen en düşük fiyat: ${game.currentPrice} TL. Gerçek indirim geçmişi ve fırsat puanı.`,
  };
}

export default async function GameDetailPage({ params }: GamePageProps) {
  const { slug } = await params;

  const game = await prisma.game.findUnique({
    where: { slug },
    include: {
      dealAnalysis: true,
      priceHistories: {
        orderBy: { observedAt: "desc" },
      },
      // If this product is a bundle, get child products (where this game is parent)
      childRelations: {
        where: { relationType: RelationType.BUNDLE_CONTAINS },
        include: { childGame: true },
        orderBy: { position: "asc" },
      },
      // If this product is an add-on, find parent base game (where this game is child)
      parentRelations: {
        where: {
          relationType: {
            in: [
              RelationType.ADDON_OF,
              RelationType.DLC_OF,
              RelationType.EXPANSION_OF,
              RelationType.SEASON_PASS_OF,
            ],
          },
        },
        include: { parentGame: true },
      },
    },
  });

  if (!game) {
    notFound();
  }

  // On-demand bundle content auto-recovery & verification from Microsoft Display Catalog
  const knownKids = KNOWN_BUNDLE_CHILDREN[game.xboxProductId.toUpperCase()] || [];
  const existingChildBigIds = new Set(game.childRelations.map((r) => r.childGame.xboxProductId.toUpperCase()));
  const missingKnownKids = knownKids.filter((id) => !existingChildBigIds.has(id.toUpperCase()));

  // A bundle candidate matches bundle/edition keywords, known bundle registry, BUNDLE class, or existing relations
  const isTitleBundle = /(bundle|koleksiyon|collection|trilogy|saga|anthology|ikili paket|çift paket|\bpack\b|gold edition|deluxe edition|ultimate edition|complete edition|definitive edition)/i.test(game.title);
  const isKnownBundle = knownKids.length > 0;
  const isBundleCandidate =
    isTitleBundle ||
    isKnownBundle ||
    game.productClass === "BUNDLE" ||
    game.childRelations.length > 0;

  const isAlreadyV2Enriched =
    game.childRelations.length > 0 &&
    game.childRelations.every((r) => r.source === BUNDLE_RELATION_SOURCE_V2);

  if (isBundleCandidate && (!isAlreadyV2Enriched || missingKnownKids.length > 0)) {
    try {
      const enrichResult = await enrichBundleChildrenFromCatalog(game.id, game.xboxProductId);

      if (enrichResult.childCount > 0) {
        if (game.productClass !== "BUNDLE" && (isTitleBundle || isKnownBundle || enrichResult.childCount >= 2)) {
          await prisma.game.update({
            where: { id: game.id },
            data: { productClass: "BUNDLE" },
          });
          game.productClass = "BUNDLE";
        }
        game.childRelations = await prisma.gameRelation.findMany({
          where: { parentGameId: game.id, relationType: RelationType.BUNDLE_CONTAINS },
          include: { childGame: true },
          orderBy: { position: "asc" },
        });
      } else if (!isTitleBundle && !isKnownBundle) {
        // Not a real bundle in Display Catalog: purge any legacy inverted relations and fix productClass
        if (game.childRelations.length > 0) {
          await prisma.gameRelation.deleteMany({
            where: { parentGameId: game.id, relationType: RelationType.BUNDLE_CONTAINS },
          });
          game.childRelations = [];
        }
        if (game.productClass === "BUNDLE") {
          await prisma.game.update({
            where: { id: game.id },
            data: { productClass: "BASE_GAME" },
          });
          game.productClass = "BASE_GAME";
        }
      }
    } catch (enrichErr: any) {
      console.warn(`[GameDetail] On-demand bundle enrichment notice:`, enrichErr.message);
    }
  }

  const isRealBundle = game.childRelations.length > 0;

  // Also query DLCs/Addons if this is a BASE_GAME or has child add-ons
  const addOnRelations = await prisma.gameRelation.findMany({
    where: {
      parentGameId: game.id,
      relationType: {
        in: [
          RelationType.ADDON_OF,
          RelationType.DLC_OF,
          RelationType.EXPANSION_OF,
          RelationType.SEASON_PASS_OF,
        ],
      },
    },
    include: { childGame: true },
    orderBy: { childGame: { discountPercent: "desc" } },
  });

  const currentUser = await getCurrentUser();
  const [userGame, alert] = currentUser
    ? await Promise.all([
        prisma.userGame.findUnique({
          where: { userId_gameId: { userId: currentUser.userId, gameId: game.id } },
        }),
        prisma.priceAlert.findFirst({
          where: { userId: currentUser.userId, gameId: game.id },
        }),
      ])
    : [null, null];

  const currentPrice = game.currentPrice.toNumber();
  const listPrice = game.listPrice.toNumber();
  const historicalLow = game.historicalLow.toNumber();
  const isAtHistoricalLow = currentPrice <= historicalLow && game.discountPercent > 0;

  // Chart data
  const chartData = [...game.priceHistories]
    .reverse()
    .map((h) => ({
      observedAt: h.observedAt.toISOString(),
      currentPrice: h.currentPrice.toNumber(),
      listPrice: h.listPrice.toNumber(),
      isOnSale: h.isOnSale,
    }));

  // Safely parse JSON metadata
  const genres: string[] = Array.isArray(game.genres) ? (game.genres as string[]) : [];
  const capabilities: string[] = Array.isArray(game.capabilities) ? (game.capabilities as string[]) : [];
  const screenshots: string[] = Array.isArray(game.screenshots) ? (game.screenshots as string[]) : [];

  // Bundle economics calculation
  const isBundle = isRealBundle && game.childRelations.length > 0;
  const bundleChildren = game.childRelations.map((r) => r.childGame).filter(Boolean);
  const totalBundleChildren = game.childRelations.length;
  const pricedChildren = bundleChildren.filter((c) => c != null);
  const sumChildPrices = pricedChildren.reduce((sum, c) => sum + c.currentPrice.toNumber(), 0);
  const sumChildListPrices = pricedChildren.reduce((sum, c) => sum + c.listPrice.toNumber(), 0);
  const bundleSavings = sumChildPrices - currentPrice;
  const bundleSavingsPercent =
    sumChildPrices > 0 ? Math.round((bundleSavings / sumChildPrices) * 100) : 0;

  // Parent base game (if this is a DLC / Add-on)
  const parentBaseGame = game.parentRelations.length > 0 ? game.parentRelations[0].parentGame : null;

  const classBadge = CLASS_LABELS[game.productClass] || CLASS_LABELS.UNKNOWN;

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/" className="hover:text-emerald-400">Ana Sayfa</Link>
        <span>/</span>
        <Link
          href={["DLC", "ADD_ON", "EXPANSION", "SEASON_PASS", "CONTENT_PACK"].includes(game.productClass) ? "/eklentiler" : "/firsatlar"}
          className="hover:text-emerald-400"
        >
          {["DLC", "ADD_ON", "EXPANSION", "SEASON_PASS", "CONTENT_PACK"].includes(game.productClass) ? "DLC & Eklentiler" : "Fırsatlar"}
        </Link>
        <span>/</span>
        <span className="text-zinc-200 truncate max-w-xs">{game.title}</span>
      </nav>

      {/* Parent Game Warning Banner (If this is a DLC / Add-on) */}
      {parentBaseGame && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/20 p-2.5 text-blue-400 border border-blue-500/30 shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider block">
                Ana Oyun Gerekliliği
              </span>
              <p className="text-sm text-zinc-200 mt-0.5">
                Bu içerik bir eklentidir. Oynayabilmek için <strong className="text-white font-semibold">{parentBaseGame.title}</strong> ana oyununa sahip olmanız gerekir.
              </p>
            </div>
          </div>
          <Link
            href={`/oyun/${parentBaseGame.slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors shrink-0"
          >
            <span>Ana Oyunu İncele</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Main Game Header Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Cover Art */}
          <div className="relative aspect-[3/4] w-full max-w-xs mx-auto md:mx-0 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
            {game.imageUrl ? (
              <Image
                src={getOptimizedImageUrl(game.imageUrl, "detail")}
                alt={game.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-600 text-sm">
                Kapak Resmi Yok
              </div>
            )}
            {game.discountPercent > 0 && (
              <div className="absolute top-3 left-3 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-black text-black shadow-lg flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                %{game.discountPercent} İNDİRİM
              </div>
            )}
          </div>

          {/* Details & Price */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${classBadge.color}`}>
                  {classBadge.label}
                </span>
                {game.dealAnalysis && (
                  <DealBadge
                    verdict={game.dealAnalysis.verdict}
                    dealScore={game.dealAnalysis.dealScore}
                    size="md"
                  />
                )}
                {game.dealAnalysis && (
                  <ConfidenceBadge confidence={game.dealAnalysis.confidenceScore} />
                )}
                {game.isCore && (
                  <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    Önemli Seri
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {game.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                {game.publisher && (
                  <span className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-zinc-500" />
                    Yayıncı: {game.publisher}
                  </span>
                )}
                {game.developer && (
                  <span className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-zinc-500" />
                    Geliştirici: {game.developer}
                  </span>
                )}
                {game.releaseDate && (
                  <span className="flex items-center gap-1.5" suppressHydrationWarning>
                    <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                    Çıkış: {formatDate(game.releaseDate)}
                  </span>
                )}
                {game.franchise && (
                  <span className="flex items-center gap-1.5">
                    <Gamepad2 className="h-3.5 w-3.5 text-zinc-500" />
                    Seri: {game.franchise}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-zinc-500" />
                  ID: {game.xboxProductId}
                </span>
              </div>

              {/* Genre Badges */}
              {genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-md bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 text-[11px] text-zinc-300"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Price Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
                <div>
                  <span className="text-xs text-zinc-400 block mb-1">Güncel Satış Fiyatı</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {formatPrice(currentPrice)} {game.currency}
                    </span>
                    {game.discountPercent > 0 && (
                      <span className="text-base text-zinc-400 line-through">
                        {formatPrice(listPrice)} {game.currency}
                      </span>
                    )}
                  </div>
                </div>

                <XboxStoreActions
                  storeUrl={game.storeUrl}
                  xboxProductId={game.xboxProductId}
                  gameTitle={game.title}
                />
              </div>

              {/* Personal Actions */}
              <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-zinc-400 font-medium">Kişisel İşlemler:</span>
                <GameActions
                  gameId={game.id}
                  gameTitle={game.title}
                  currentPrice={currentPrice}
                  initialUserGame={userGame}
                  initialAlert={
                    alert
                      ? {
                          type: alert.type,
                          isEnabled: alert.isEnabled,
                          targetPrice: alert.targetPrice ? alert.targetPrice.toNumber() : null,
                          targetDiscount: alert.targetDiscount,
                          targetDealScore: alert.targetDealScore,
                        }
                      : null
                  }
                />
              </div>

              {/* Observed Low Row */}
              <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-zinc-400">Gözlemlenen En Düşük Fiyat: </span>
                    <strong className={`text-sm ${isAtHistoricalLow ? "text-emerald-400" : "text-white"}`}>
                      {formatPrice(historicalLow)} {game.currency}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div suppressHydrationWarning>
                    <span className="text-zinc-400">Gözlem Tarihi: </span>
                    <strong className="text-zinc-300">
                      {formatDate(game.historicalLowAt)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Deal Analysis Decision Reason */}
            {game.dealAnalysis && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Fırsat Kararı Analizi
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    Puan: {game.dealAnalysis.dealScore} / 100
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {game.dealAnalysis.reason}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bundle Intelligence Section (Only rendered if product is a bundle) */}
      {isBundle && totalBundleChildren > 0 && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/10 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-500/20 p-2 text-purple-400 border border-purple-500/30">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Paket İçerik ve Fiyat Analizi
                  <span className="text-xs font-normal text-purple-300">
                    ({pricedChildren.length} / {totalBundleChildren} ürün doğrulandı)
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Paket içerisindeki ürünlerin ayrı ayrı fiyatları ile paket fiyatının karşılaştırması
                </p>
              </div>
            </div>

            {/* Bundle Savings Card */}
            {pricedChildren.length === totalBundleChildren && totalBundleChildren > 0 && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-900/30 px-4 py-2.5 text-right">
                <span className="text-[11px] text-purple-300 block">Ayrı Alım vs Paket</span>
                <div className="text-sm font-bold text-white">
                  {bundleSavings > 0 ? (
                    <span className="text-emerald-400 font-extrabold">
                      %{bundleSavingsPercent} Avantaj ({formatPrice(bundleSavings)} TL Kazanç)
                    </span>
                  ) : bundleSavings === 0 ? (
                    <span className="text-zinc-300">Fiyatlar Eşit</span>
                  ) : (
                    <span className="text-amber-400">Ayrı Almak Daha Uygun</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Truthful Status Banner if Partial Info */}
          {pricedChildren.length < totalBundleChildren && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 flex items-center gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Doğruluk Bildirimi: Bu paketteki {totalBundleChildren} üründen {pricedChildren.length} tanesinin ayrı mağaza fiyatı sistemimizde mevcuttur. Eksik ürünlerin mağaza kaydı bulunmadığından toplam tasarruf tutarı kısmi olarak hesaplanmıştır.
              </span>
            </div>
          )}

          {/* Bundle Economics Comparison Summary */}
          {pricedChildren.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <span className="text-[11px] text-zinc-400 block mb-1">Ayrı Ayrı Satış Fiyatları Toplamı</span>
                <span className="text-lg font-bold text-zinc-200">
                  {formatPrice(sumChildPrices)} {game.currency}
                </span>
                {sumChildListPrices > sumChildPrices && (
                  <span className="text-xs text-zinc-500 line-through block">
                    {formatPrice(sumChildListPrices)} {game.currency} liste
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 p-4">
                <span className="text-[11px] text-purple-300 block mb-1">Paket Satış Fiyatı</span>
                <span className="text-lg font-black text-purple-200">
                  {formatPrice(currentPrice)} {game.currency}
                </span>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <span className="text-[11px] text-zinc-400 block mb-1">Paket Avantaj Durumu</span>
                <span className={`text-base font-bold ${bundleSavings > 0 ? "text-emerald-400" : "text-zinc-300"}`}>
                  {bundleSavings > 0
                    ? `${formatPrice(bundleSavings)} TL Daha Ucuz`
                    : bundleSavings === 0
                    ? "Aynı Fiyat"
                    : `${formatPrice(Math.abs(bundleSavings))} TL Daha Pahalı`}
                </span>
              </div>
            </div>
          )}

          {/* Child Games List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Paket İçeriğindeki Ürünler ({bundleChildren.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bundleChildren.map((child) => {
                const childBadge = CLASS_LABELS[child.productClass] || CLASS_LABELS.UNKNOWN;
                return (
                  <Link
                    key={child.id}
                    href={`/oyun/${child.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 hover:border-purple-500/40 transition-colors group"
                  >
                    <div className="relative h-16 w-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                      {child.imageUrl ? (
                        <Image
                          src={getOptimizedImageUrl(child.imageUrl, "thumb")}
                          alt={child.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-600">
                          Resim Yok
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`rounded px-1.5 py-0.2 text-[9px] font-medium border ${childBadge.color}`}>
                          {childBadge.label}
                        </span>
                      </div>
                      <h5 className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                        {child.title}
                      </h5>
                      <div className="mt-1 flex items-baseline gap-2 text-xs">
                        {child.currentPrice.toNumber() > 0 ? (
                          <>
                            <span className="font-bold text-white">
                              {formatPrice(child.currentPrice.toNumber())} {child.currency}
                            </span>
                            {child.discountPercent > 0 && (
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                -%{child.discountPercent}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300 border border-purple-500/30">
                            Pakete Dahil
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Verified DLCs & Add-ons Section (Rendered if base game has child add-ons) */}
      {addOnRelations.length > 0 && (
        <div className="rounded-2xl border border-blue-500/30 bg-zinc-900/60 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/20 p-2 text-blue-400 border border-blue-500/30">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Bu Oyunun DLC ve Eklentileri
                  <span className="text-xs font-normal text-blue-300">
                    ({addOnRelations.length} içerik doğrulandı)
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Microsoft Display Catalog üzerinden doğrulanmış resmi eklentiler ve sezon biletleri
                </p>
              </div>
            </div>
            <Link
              href="/eklentiler"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
            >
              <span>Tüm Eklentiler</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {addOnRelations.map((rel) => {
              const dlc = rel.childGame;
              const dlcBadge = CLASS_LABELS[dlc.productClass] || CLASS_LABELS.UNKNOWN;
              return (
                <Link
                  key={dlc.id}
                  href={`/oyun/${dlc.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 hover:border-blue-500/40 transition-colors group"
                >
                  <div className="relative h-16 w-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                    {dlc.imageUrl ? (
                      <Image
                        src={getOptimizedImageUrl(dlc.imageUrl, "thumb")}
                        alt={dlc.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-600">
                        Resim Yok
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`rounded px-1.5 py-0.2 text-[9px] font-medium border ${dlcBadge.color}`}>
                        {dlcBadge.label}
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                      {dlc.title}
                    </h5>
                    <div className="mt-1 flex items-baseline gap-2 text-xs">
                      <span className="font-bold text-white">
                        {formatPrice(dlc.currentPrice.toNumber())} {dlc.currency}
                      </span>
                      {dlc.discountPercent > 0 && (
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          -%{dlc.discountPercent}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* About & Game Details */}
      {(game.shortDescription || game.longDescription || capabilities.length > 0) && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
          <h3 className="text-base font-bold text-white">Oyun Hakkında</h3>
          
          {/* Capabilities Badges */}
          {capabilities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {capabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-lg bg-zinc-800/80 border border-zinc-700/60 px-3 py-1 text-xs text-zinc-300 flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  {cap}
                </span>
              ))}
            </div>
          )}

          {/* Plain Text Description (XSS Safe - No dangerouslySetInnerHTML) */}
          <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-3 whitespace-pre-line max-h-96 overflow-y-auto pr-2">
            {game.shortDescription || game.longDescription}
          </div>
        </div>
      )}

      {/* Screenshots Gallery */}
      {screenshots.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Ekran Görüntüleri</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {screenshots.slice(0, 6).map((shotUrl, idx) => (
              <div
                key={idx}
                className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-md group"
              >
                <Image
                  src={getOptimizedImageUrl(shotUrl, "screenshot")}
                  alt={`${game.title} Ekran Görüntüsü ${idx + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Truthful Price History Chart */}
      <PriceHistoryChart
        data={chartData}
        historicalLow={historicalLow}
        currency={game.currency}
      />

      {/* Price History Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {game.priceHistories.length > 1 ? "Fiyat Değişim Kayıtları" : "Fiyat Gözlem Kayıtları"}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {game.priceHistories.length > 1
              ? `Sistemimiz tarafından tespit edilen gerçek fiyat hareketleri (toplam ${game.priceHistories.length} gözlem)`
              : "Bu ürün takibe yeni alındı. Şu anda yalnızca başlangıç referans kaydı mevcuttur (Mağazada henüz yeni bir fiyat değişimi gerçekleşmedi)."}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Gözlem Zamanı</th>
                <th className="py-2.5 px-3">Satış Fiyatı</th>
                <th className="py-2.5 px-3">Fiyat Değişimi</th>
                <th className="py-2.5 px-3">Liste Fiyatı</th>
                <th className="py-2.5 px-3">İndirim Oranı</th>
                <th className="py-2.5 px-3">Kampanya Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {game.priceHistories.map((h, idx) => {
                const prev = game.priceHistories[idx + 1];
                const prevPrice = prev ? prev.currentPrice.toNumber() : null;
                const currPrice = h.currentPrice.toNumber();
                const diff = prevPrice !== null ? currPrice - prevPrice : null;

                return (
                  <tr key={h.id} className="hover:bg-zinc-800/30">
                    <td className="py-2.5 px-3 font-sans text-zinc-300" suppressHydrationWarning>
                      {formatDateTime(h.observedAt)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {formatPrice(currPrice)} {h.currency}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {diff === null ? (
                        <span className="inline-flex rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-400 border border-zinc-700/60">
                          İlk Tespit (Referans)
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60">
                          ↓ -{formatPrice(Math.abs(diff))} {h.currency} İndirim
                        </span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-800/60">
                          ↑ +{formatPrice(diff)} {h.currency} Artış
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[10px]">Değişim Yok</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {formatPrice(h.listPrice.toNumber())} {h.currency}
                    </td>
                    <td className="py-2.5 px-3">
                      {h.discountPercent > 0 ? (
                        <span className="text-emerald-400 font-semibold">%{h.discountPercent}</span>
                      ) : (
                        <span className="text-zinc-400">-%</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {h.isOnSale ? (
                        <span className="inline-flex rounded bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-300 border border-emerald-800/40">
                          İndirimde
                        </span>
                      ) : (
                        <span className="text-zinc-400">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
