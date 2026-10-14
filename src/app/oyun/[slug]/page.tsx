import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { DealBadge, ConfidenceBadge } from "@/components/game/deal-badge";
import { PriceHistoryChart } from "@/components/game/price-history-chart";
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
} from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 60;

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

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
    },
  });

  if (!game) {
    notFound();
  }

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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/" className="hover:text-emerald-400">Ana Sayfa</Link>
        <span>/</span>
        <Link href="/firsatlar" className="hover:text-emerald-400">Fırsatlar</Link>
        <span>/</span>
        <span className="text-zinc-200 truncate max-w-xs">{game.title}</span>
      </nav>

      {/* Main Game Header Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Cover Art */}
          <div className="relative aspect-[3/4] w-full max-w-xs mx-auto md:mx-0 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
            {game.imageUrl ? (
              <Image
                src={game.imageUrl}
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
                    {game.publisher}
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
            </div>

            {/* Price Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
                <div>
                  <span className="text-xs text-zinc-400 block mb-1">Güncel Satış Fiyatı</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {currentPrice.toLocaleString("tr-TR")} {game.currency}
                    </span>
                    {game.discountPercent > 0 && (
                      <span className="text-base text-zinc-400 line-through">
                        {listPrice.toLocaleString("tr-TR")} {game.currency}
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={game.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Xbox Mağazasında Aç</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {/* Observed Low Row */}
              <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-zinc-400">Gözlemlenen En Düşük Fiyat: </span>
                    <strong className={`text-sm ${isAtHistoricalLow ? "text-emerald-400" : "text-white"}`}>
                      {historicalLow.toLocaleString("tr-TR")} {game.currency}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div>
                    <span className="text-zinc-400">Gözlem Tarihi: </span>
                    <strong className="text-zinc-300">
                      {new Date(game.historicalLowAt).toLocaleDateString("tr-TR")}
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

      {/* Chart Section */}
      <PriceHistoryChart
        data={chartData}
        historicalLow={historicalLow}
        currency={game.currency}
      />

      {/* Price History Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Fiyat Değişim Kayıtları</h3>
        <p className="text-xs text-zinc-400">
          Yalnızca fiyat değişikliği gerçekleştiğinde açılan kayıtlar (toplam {game.priceHistories.length} gözlem)
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Gözlem Zamanı</th>
                <th className="py-2.5 px-3">Satış Fiyatı</th>
                <th className="py-2.5 px-3">Liste Fiyatı</th>
                <th className="py-2.5 px-3">İndirim</th>
                <th className="py-2.5 px-3">Kampanya Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {game.priceHistories.map((h) => (
                <tr key={h.id} className="hover:bg-zinc-800/30">
                  <td className="py-2.5 px-3 font-sans text-zinc-300">
                    {new Date(h.observedAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">
                    {h.currentPrice.toNumber().toLocaleString("tr-TR")} {h.currency}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">
                    {h.listPrice.toNumber().toLocaleString("tr-TR")} {h.currency}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
