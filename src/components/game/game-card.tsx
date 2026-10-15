import Link from "next/link";
import Image from "next/image";
import { DealBadge } from "./deal-badge";
import { TrendingDown, Award } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";
import { formatPrice } from "@/lib/formatters";

export interface GameCardProps {
  id: string;
  slug: string;
  title: string;
  publisher?: string | null;
  imageUrl?: string | null;
  currentPrice: Prisma.Decimal | number;
  listPrice: Prisma.Decimal | number;
  discountPercent: number;
  currency: string;
  historicalLow: Prisma.Decimal | number;
  dealAnalysis?: {
    dealScore: number;
    verdict: any;
    confidenceScore: any;
  } | null;
  isCore?: boolean;
  platforms?: string[];
  releaseDate?: Date | string | null;
}

export function GameCard({
  slug,
  title,
  publisher,
  imageUrl,
  currentPrice,
  listPrice,
  discountPercent,
  currency,
  historicalLow,
  dealAnalysis,
  platforms,
  releaseDate,
}: GameCardProps) {
  const currentNum = typeof currentPrice === "number" ? currentPrice : currentPrice.toNumber();
  const listNum = typeof listPrice === "number" ? listPrice : listPrice.toNumber();
  const lowNum = typeof historicalLow === "number" ? historicalLow : historicalLow.toNumber();

  const isAtHistoricalLow = currentNum <= lowNum && discountPercent > 0;

  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const validYear =
    releaseYear && !isNaN(releaseYear) && releaseYear >= 1990 && releaseYear <= 2050
      ? releaseYear
      : null;

  return (
    <Link
      href={`/oyun/${slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-zinc-800/80 hover:shadow-xl hover:shadow-emerald-950/20"
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
        {imageUrl ? (
          <Image
            src={getOptimizedImageUrl(imageUrl, "card")}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600 text-xs">
            Görsel Yok
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10">
          <div className="flex items-center gap-1">
            {discountPercent > 0 ? (
              <span className="flex items-center gap-0.5 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-black shadow-md">
                <TrendingDown className="h-3.5 w-3.5" />
                %{discountPercent}
              </span>
            ) : (
              <span className="rounded-md bg-zinc-900/80 px-2 py-0.5 text-[11px] font-medium text-zinc-400 backdrop-blur-sm">
                Standart
              </span>
            )}
            {platforms?.includes("XboxSeriesX") ? (
              <span className="rounded-md bg-zinc-950/90 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 backdrop-blur-sm shadow-sm" title="Xbox Series X|S">
                X|S
              </span>
            ) : platforms?.includes("XboxOne") ? (
              <span className="rounded-md bg-zinc-950/90 border border-zinc-700/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 backdrop-blur-sm shadow-sm" title="Xbox One">
                One
              </span>
            ) : null}
          </div>

          {isAtHistoricalLow && (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-black backdrop-blur-sm shadow-md animate-pulse">
              <Award className="h-3 w-3" />
              Tarihi Dip
            </span>
          )}
        </div>

        {/* Deal verdict pill on bottom of cover */}
        {dealAnalysis && (
          <div className="absolute bottom-2 left-2 z-10">
            <DealBadge
              verdict={dealAnalysis.verdict}
              dealScore={dealAnalysis.dealScore}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          {(publisher || validYear) && (
            <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-zinc-400 mb-0.5">
              <span className="truncate">{publisher || ""}</span>
              {validYear && (
                <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                  {validYear}
                </span>
              )}
            </div>
          )}
          <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
            {title}
          </h3>
        </div>

        <div className="mt-3 pt-2.5 border-t border-zinc-800/80">
          {/* Prices */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                {formatPrice(currentNum)} {currency}
              </span>
              {discountPercent > 0 && (
                <span className="text-[11px] sm:text-xs text-zinc-400 line-through">
                  {formatPrice(listNum)} {currency}
                </span>
              )}
            </div>
          </div>

          {/* Truthful Observed Low */}
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="truncate">Gözlemlenen Dip:</span>
            <span className={`font-semibold ${isAtHistoricalLow ? "text-emerald-400" : "text-zinc-300"}`}>
              {formatPrice(lowNum)} {currency}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
