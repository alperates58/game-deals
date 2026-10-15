"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Flame,
  TrendingDown,
  ArrowRight,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";

export interface FeaturedDealItem {
  id: string;
  slug: string;
  title: string;
  publisher?: string | null;
  imageUrl?: string | null;
  screenshots: string[];
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  currency: string;
  historicalLow: number;
  dealAnalysis?: {
    dealScore: number;
    verdict: string;
  } | null;
}

interface FeaturedDealsSliderProps {
  deals?: FeaturedDealItem[];
  topDeals?: FeaturedDealItem[];
  recentDrops?: FeaturedDealItem[];
  dropTabLabel?: string;
}

export function FeaturedDealsSlider({
  deals,
  topDeals,
  recentDrops,
  dropTabLabel = "Yeni Fiyatı Düşenler",
}: FeaturedDealsSliderProps) {
  const [activeTab, setActiveTab] = useState<"top" | "drops">("top");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean>(false);

  const effectiveTop = topDeals && topDeals.length > 0 ? topDeals : deals || [];
  const effectiveDrops = recentDrops && recentDrops.length > 0 ? recentDrops : [];
  const hasTabs = effectiveTop.length > 0 && effectiveDrops.length > 0;

  const currentDeals = hasTabs && activeTab === "drops" ? effectiveDrops : effectiveTop;
  const total = currentDeals.length;

  const handleTabChange = (tab: "top" | "drops") => {
    setActiveTab(tab);
    setCurrentIndex(0);
  };

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-play timer (5 seconds)
  useEffect(() => {
    if (total <= 1 || isPaused || isDragging) return;

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, isDragging, nextSlide, currentIndex]);

  // Touch Swipe Handlers for mobile & tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (total <= 1) return;
    setIsPaused(true);
    setIsDragging(true);
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    isHorizontalSwipe.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Check if the user is deliberately swiping horizontally
    if (!isHorizontalSwipe.current) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        isHorizontalSwipe.current = true;
      } else if (Math.abs(deltaY) > 8) {
        // Vertical scroll - don't interfere with page scrolling
        return;
      }
    }

    if (isHorizontalSwipe.current) {
      touchCurrentX.current = currentX;
      // Dampened tactile offset
      const maxDrag = 120;
      const resistance = 0.65;
      const offset = Math.sign(deltaX) * Math.min(Math.abs(deltaX) * resistance, maxDrag);
      setDragOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    setIsDragging(false);

    if (
      touchStartX.current !== null &&
      touchCurrentX.current !== null &&
      isHorizontalSwipe.current
    ) {
      const diff = touchCurrentX.current - touchStartX.current;
      const SWIPE_THRESHOLD = 40; // minimum pixels to trigger slide

      if (diff < -SWIPE_THRESHOLD) {
        nextSlide();
      } else if (diff > SWIPE_THRESHOLD) {
        prevSlide();
      }
    }

    // Reset touch coordinates
    setDragOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
    touchCurrentX.current = null;
    isHorizontalSwipe.current = false;
  };

  if (total === 0) {
    return null;
  }

  const current = currentDeals[currentIndex];
  const isAtHistoricalLow =
    current.currentPrice <= current.historicalLow && current.discountPercent > 0;

  // Background image priority: first screenshot, fallback to cover imageUrl
  const rawBackdrop =
    current.screenshots && current.screenshots.length > 0
      ? current.screenshots[0]
      : current.imageUrl;
  const backdropImage = getOptimizedImageUrl(rawBackdrop, "backdrop");

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getVerdictLabel = (verdict?: string | null, score?: number) => {
    if (score && score >= 85) return "Mükemmel Fırsat";
    if (score && score >= 70) return "Çok İyi Fırsat";
    if (score && score >= 50) return "İyi Fırsat";
    if (score && score >= 40) return "Orta Fırsat";
    return "Fırsat";
  };

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 p-4 sm:p-7 shadow-2xl transition-all duration-300 hover:border-emerald-500/40 w-full max-w-full select-none touch-pan-y"
      style={{ touchAction: "pan-y" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Ambient Backdrop Image with Cinematic Gradient & Strict Containment */}
      {backdropImage && (
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
          style={{ contain: "paint" }}
        >
          <Image
            src={backdropImage}
            alt={current.title}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover opacity-20 blur-sm scale-105 transition-all duration-700 ease-out"
            priority={currentIndex === 0}
          />
          {/* Multi-layered dark gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-zinc-950/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/60" />
          {/* Subtle neon emerald accent contained within boundary */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Header bar: Dual Tabs / Badge & Slide Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-zinc-800/50">
        {hasTabs ? (
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => handleTabChange("top")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-all ${
                activeTab === "top"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-emerald-400" />
              <span>Günün Fırsatları</span>
              <span className="text-[10px] opacity-80 font-mono">({effectiveTop.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("drops")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-all ${
                activeTab === "drops"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
              }`}
            >
              <TrendingDown className="h-3.5 w-3.5 text-cyan-400" />
              <span>{dropTabLabel}</span>
              <span className="text-[10px] opacity-80 font-mono">({effectiveDrops.length})</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-400 truncate">
              Günün Öne Çıkan Fırsatı
            </span>
          </div>
        )}

        {/* Slide Counter & Arrows */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span className="text-[11px] font-mono text-zinc-400 pr-1">
            <span className="text-zinc-200 font-semibold">
              {String(currentIndex + 1).padStart(2, "0")}
            </span>
            <span className="text-zinc-600"> / </span>
            <span>{String(total).padStart(2, "0")}</span>
          </span>

          <button
            type="button"
            onClick={prevSlide}
            aria-label="Önceki Fırsat"
            className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-white active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Sonraki Fırsat"
            className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-white active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Content with Smooth Tactile Drag Transform */}
      <div
        className="relative z-10 my-auto py-3 w-full"
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging
            ? "none"
            : "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6 items-center">
          {/* Left: Game Cover Poster */}
          <div className="sm:col-span-4 flex justify-center sm:justify-start">
            <Link
              href={`/oyun/${current.slug}`}
              className="group/poster relative block aspect-[3/4] w-32 sm:w-full max-w-[160px] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl transition-all duration-300 hover:scale-105 hover:border-emerald-500/70 hover:shadow-emerald-950/40 shrink-0"
            >
              {current.imageUrl ? (
                <Image
                  src={getOptimizedImageUrl(current.imageUrl, "card")}
                  alt={current.title}
                  fill
                  sizes="(max-width: 640px) 130px, 160px"
                  className="object-cover"
                  priority={currentIndex === 0}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  Görsel Yok
                </div>
              )}

              {/* Discount Ribbon on Poster */}
              {current.discountPercent > 0 && (
                <div className="absolute top-2 left-2 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-black shadow-md">
                  -%{current.discountPercent}
                </div>
              )}
            </Link>
          </div>

          {/* Right: Info, Price, Verdict, CTA */}
          <div className="sm:col-span-8 flex flex-col justify-center space-y-2.5 sm:space-y-3 min-w-0">
            {/* Top Tags */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {current.dealAnalysis && (
                <span className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-emerald-400 backdrop-blur-md">
                  <Zap className="h-3 w-3 fill-emerald-400 shrink-0" />
                  <span>
                    {current.dealAnalysis.dealScore} Puan · {getVerdictLabel(current.dealAnalysis.verdict, current.dealAnalysis.dealScore)}
                  </span>
                </span>
              )}

              {isAtHistoricalLow && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/70 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-amber-300 backdrop-blur-md">
                  <Flame className="h-3 w-3 fill-amber-300 shrink-0" />
                  <span>Tarihi Dip</span>
                </span>
              )}
            </div>

            {/* Game Title & Publisher */}
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-medium text-zinc-400 truncate">
                {current.publisher || "Xbox Series X|S"}
              </p>
              <Link
                href={`/oyun/${current.slug}`}
                className="group-hover:text-emerald-400 transition-colors inline-block max-w-full"
              >
                <h3 className="text-base sm:text-xl font-extrabold text-white tracking-tight line-clamp-2 break-words">
                  {current.title}
                </h3>
              </Link>
            </div>

            {/* Price Box */}
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 pt-0.5">
              <div>
                <span className="text-xl sm:text-3xl font-black tracking-tight text-white">
                  {formatPrice(current.currentPrice)}{" "}
                  <span className="text-sm sm:text-base font-bold text-emerald-400">
                    {current.currency}
                  </span>
                </span>
              </div>

              {current.listPrice > current.currentPrice && (
                <span className="text-xs sm:text-sm font-semibold text-zinc-500 line-through">
                  {formatPrice(current.listPrice)} {current.currency}
                </span>
              )}
            </div>

            {/* Historical Low Comparison */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-zinc-400">
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Gözlemlenen Dip:</span>
              <span className="font-semibold text-zinc-200">
                {formatPrice(current.historicalLow)} {current.currency}
              </span>
              {isAtHistoricalLow && (
                <span className="font-bold text-emerald-400">(Şu an dipte)</span>
              )}
            </div>

            {/* Action CTA Button */}
            <div className="pt-1 sm:pt-2 flex items-center justify-between">
              <Link
                href={`/oyun/${current.slug}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Fırsatı İncele</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              {/* Mobile swipe helper text */}
              <span className="sm:hidden text-[10px] text-zinc-500 font-medium">
                Kaydırarak geçiş yap ↔
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar: Navigation Dots & Progress */}
      <div className="relative z-10 flex items-center justify-between pt-3 sm:pt-4 border-t border-zinc-800/60 mt-2 sm:mt-3">
        {/* Navigation Indicator Pills */}
        <div className="flex items-center gap-1.5">
          {currentDeals.map((deal, idx) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Fırsat ${idx + 1}: ${deal.title}`}
              className={`h-2 sm:h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-6 bg-emerald-400"
                  : "w-2 bg-zinc-700 hover:bg-zinc-500"
              }`}
            />
          ))}
        </div>

        {/* Auto-play Status indicator */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-500">
          {isPaused ? (
            <span className="flex items-center gap-1 text-zinc-400">
              <Pause className="h-3 w-3" /> Duraklatıldı
            </span>
          ) : (
            <span className="flex items-center gap-1 text-zinc-500">
              <Play className="h-2.5 w-2.5 opacity-60" /> Otomatik
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
