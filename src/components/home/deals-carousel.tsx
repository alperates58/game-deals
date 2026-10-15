"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ChevronRight as ArrowRight, TrendingDown, Award, Zap } from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";
import { DealBadge } from "@/components/game/deal-badge";
import { formatPrice } from "@/lib/formatters";

export interface CarouselGameItem {
  id: string;
  slug: string;
  title: string;
  publisher?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  currency: string;
  historicalLow: number;
  dealAnalysis?: {
    dealScore: number;
    verdict: any;
    confidenceScore?: any;
  } | null;
}

interface DealsCarouselProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconStyle?: string;
  seeAllHref?: string;
  seeAllText?: string;
  games: CarouselGameItem[];
  highlightBadge?: "historicalLow" | "dealScore" | "budget";
}

export function DealsCarousel({
  title,
  subtitle,
  icon,
  iconStyle = "bg-emerald-950 border-emerald-500/40 text-emerald-400",
  seeAllHref,
  seeAllText = "Tümünü Gör",
  games,
  highlightBadge,
}: DealsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [games]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = Math.max(scrollRef.current.clientWidth * 0.75, 260);
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!games || games.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconStyle}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
              {title}
            </h2>
            <p className="text-xs text-zinc-400 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="hidden sm:flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors mr-2"
            >
              <span>{seeAllText}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Desktop Left/Right Scroll Arrows */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Sola Kaydır"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Sağa Kaydır"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {games.map((game) => {
            const isAtHistoricalLow = game.currentPrice <= game.historicalLow && game.discountPercent > 0;

            return (
              <div
                key={game.id}
                className="w-40 sm:w-48 md:w-52 shrink-0 snap-start"
              >
                <Link
                  href={`/oyun/${game.slug}`}
                  className="group relative flex flex-col h-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-zinc-850 hover:shadow-xl hover:shadow-emerald-950/20"
                >
                  {/* Poster Image */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
                    {game.imageUrl ? (
                      <Image
                        src={getOptimizedImageUrl(game.imageUrl, "card")}
                        alt={game.title}
                        fill
                        sizes="(max-width: 640px) 160px, 208px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                        Resim Yok
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10">
                      {game.discountPercent > 0 && (
                        <span className="flex items-center gap-0.5 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[11px] font-black text-black shadow-md">
                          <TrendingDown className="h-3 w-3" />
                          %{game.discountPercent}
                        </span>
                      )}

                      {isAtHistoricalLow && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-black backdrop-blur-sm shadow-md animate-pulse">
                          <Award className="h-3 w-3" />
                          Tarihi Dip
                        </span>
                      )}
                    </div>

                    {/* Deal verdict pill on bottom of cover */}
                    {game.dealAnalysis && (
                      <div className="absolute bottom-2 left-2 z-10">
                        <DealBadge
                          verdict={game.dealAnalysis.verdict}
                          dealScore={game.dealAnalysis.dealScore}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="flex flex-1 flex-col justify-between p-3">
                    <div>
                      {game.publisher && (
                        <p className="text-[10px] font-medium text-zinc-400 truncate mb-0.5">
                          {game.publisher}
                        </p>
                      )}
                      <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                        {game.title}
                      </h3>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
                      {/* Price */}
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                          {formatPrice(game.currentPrice)} {game.currency}
                        </span>
                        {game.discountPercent > 0 && (
                          <span className="text-[10px] sm:text-xs text-zinc-500 line-through">
                            {formatPrice(game.listPrice)} {game.currency}
                          </span>
                        )}
                      </div>

                      {/* Historical Low */}
                      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="truncate">Tarihi Dip:</span>
                        <span className={`font-semibold ${isAtHistoricalLow ? "text-emerald-400" : "text-zinc-300"}`}>
                          {formatPrice(game.historicalLow)} {game.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile "See All" Link */}
      {seeAllHref && (
        <div className="sm:hidden text-center pt-1">
          <Link
            href={seeAllHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <span>{seeAllText}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
