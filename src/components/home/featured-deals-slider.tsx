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
  ShieldCheck,
  Pause,
  Play,
} from "lucide-react";

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
  deals: FeaturedDealItem[];
}

export function FeaturedDealsSlider({ deals }: FeaturedDealsSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = deals.length;

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
    if (total <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, nextSlide, currentIndex]);

  if (!deals || deals.length === 0) {
    return null;
  }

  const current = deals[currentIndex];
  const isAtHistoricalLow =
    current.currentPrice <= current.historicalLow && current.discountPercent > 0;

  // Background image priority: first screenshot, fallback to cover imageUrl
  const backdropImage =
    current.screenshots && current.screenshots.length > 0
      ? current.screenshots[0]
      : current.imageUrl;

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
    return "İndirimde";
  };

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 p-5 sm:p-7 shadow-2xl transition-all duration-300 hover:border-emerald-500/40"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Ambient Backdrop Image with Cinematic Gradient */}
      {backdropImage && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <Image
            src={backdropImage}
            alt={current.title}
            fill
            className="object-cover opacity-20 blur-sm scale-105 transition-all duration-700 ease-out"
            priority={currentIndex === 0}
          />
          {/* Multi-layered dark gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/60" />
          {/* Subtle neon emerald accent */}
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Header bar: Badge & Slide Controls */}
      <div className="relative z-10 flex items-center justify-between gap-2 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Günün Öne Çıkan Fırsatı
          </span>
        </div>

        {/* Slide Counter & Arrows */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-zinc-400 pr-1">
            <span className="text-zinc-200 font-semibold">{String(currentIndex + 1).padStart(2, "0")}</span>
            <span className="text-zinc-600"> / </span>
            <span>{String(total).padStart(2, "0")}</span>
          </span>

          <button
            onClick={prevSlide}
            aria-label="Önceki Fırsat"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Sonraki Fırsat"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Content: Poster + Game Details */}
      <div className="relative z-10 my-auto py-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          {/* Left: Game Cover Poster */}
          <div className="sm:col-span-4 flex justify-center sm:justify-start">
            <Link
              href={`/oyun/${current.slug}`}
              className="group/poster relative block aspect-[3/4] w-36 sm:w-full max-w-[170px] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl transition-all duration-300 hover:scale-105 hover:border-emerald-500/70 hover:shadow-emerald-950/40"
            >
              {current.imageUrl ? (
                <Image
                  src={current.imageUrl}
                  alt={current.title}
                  fill
                  className="object-cover"
                  priority={currentIndex === 0}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  Görsel Yok
                </div>
              )}

              {/* Discount Ribbon on Poster */}
              <div className="absolute top-2 left-2 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-black text-black shadow-md">
                -%{current.discountPercent}
              </div>
            </Link>
          </div>

          {/* Right: Info, Price, Verdict, CTA */}
          <div className="sm:col-span-8 flex flex-col justify-center space-y-3">
            {/* Top Tags */}
            <div className="flex flex-wrap items-center gap-2">
              {current.dealAnalysis && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-400 backdrop-blur-md">
                  <Zap className="h-3 w-3 fill-emerald-400" />
                  {current.dealAnalysis.dealScore} Puan · {getVerdictLabel(current.dealAnalysis.verdict, current.dealAnalysis.dealScore)}
                </span>
              )}

              {isAtHistoricalLow && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/70 px-2.5 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
                  <Flame className="h-3 w-3 fill-amber-300" />
                  Tarihi Dip Fiyat
                </span>
              )}
            </div>

            {/* Game Title & Publisher */}
            <div>
              <p className="text-xs font-medium text-zinc-400 truncate">
                {current.publisher || "Xbox Series X|S"}
              </p>
              <Link
                href={`/oyun/${current.slug}`}
                className="group-hover:text-emerald-400 transition-colors inline-block"
              >
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight line-clamp-2">
                  {current.title}
                </h3>
              </Link>
            </div>

            {/* Price Box */}
            <div className="flex flex-wrap items-baseline gap-3 pt-1">
              <div>
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {formatPrice(current.currentPrice)}{" "}
                  <span className="text-base font-bold text-emerald-400">{current.currency}</span>
                </span>
              </div>

              {current.listPrice > current.currentPrice && (
                <span className="text-sm font-semibold text-zinc-500 line-through">
                  {formatPrice(current.listPrice)} {current.currency}
                </span>
              )}
            </div>

            {/* Historical Low Comparison */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Gözlemlenen Dip:</span>
              <span className="font-semibold text-zinc-200">
                {formatPrice(current.historicalLow)} {current.currency}
              </span>
              {isAtHistoricalLow && (
                <span className="text-[11px] font-bold text-emerald-400">(Şu an dipte)</span>
              )}
            </div>

            {/* Action CTA Button */}
            <div className="pt-2">
              <Link
                href={`/oyun/${current.slug}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Fırsatı İncele</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar: Navigation Dots & Progress */}
      <div className="relative z-10 flex items-center justify-between pt-4 border-t border-zinc-800/60 mt-3">
        {/* Navigation Indicator Pills */}
        <div className="flex items-center gap-1.5">
          {deals.map((deal, idx) => (
            <button
              key={deal.id}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Slide ${idx + 1}: ${deal.title}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-6 bg-emerald-400"
                  : "w-2 bg-zinc-700 hover:bg-zinc-500"
              }`}
            />
          ))}
        </div>

        {/* Auto-play Status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {isPaused ? (
            <span className="flex items-center gap-1 text-zinc-400">
              <Pause className="h-3 w-3" /> Duraklatıldı
            </span>
          ) : (
            <span className="flex items-center gap-1 text-zinc-500">
              <Play className="h-2.5 w-2.5 opacity-60" /> Otomatik Dönüyor
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
