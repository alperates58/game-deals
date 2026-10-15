"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Gamepad2,
  Heart,
  CheckCircle,
  Clock,
  Layers,
  Sparkles,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { GameActions } from "@/components/game/game-actions";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";

export interface LibraryGameItem {
  id: string;
  gameId: string;
  game: {
    id: string;
    xboxProductId: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    productClass: string;
    currentPrice: number;
    listPrice: number;
    discountPercent: number;
    historicalLow: number | null;
    dealAnalysis: {
      dealScore: number;
      verdict: string;
    } | null;
    childRelations: { id: string }[];
  };
  owned: boolean;
  favorite: boolean;
  wishlist: boolean;
  liked: boolean;
  disliked: boolean;
  completed: boolean;
  createdAt: string;
}

interface LibraryViewProps {
  initialItems: LibraryGameItem[];
}

export function LibraryView({ initialItems }: LibraryViewProps) {
  const [items, setItems] = useState<LibraryGameItem[]>(initialItems);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("RECENT");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!item.game.title.toLowerCase().includes(query)) return false;
      }

      // Filter Tab
      if (activeFilter === "BASE_GAME") {
        return item.game.productClass === "BASE_GAME";
      }
      if (activeFilter === "BUNDLE") {
        return item.game.productClass === "BUNDLE";
      }
      if (activeFilter === "DLC_ADDON") {
        return ["DLC", "ADD_ON", "EXPANSION", "SEASON_PASS", "CONTENT_PACK"].includes(item.game.productClass);
      }
      if (activeFilter === "FAVORITE") {
        return item.favorite;
      }
      if (activeFilter === "COMPLETED") {
        return item.completed;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "RECENT") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "TITLE_ASC") {
        return a.game.title.localeCompare(b.game.title);
      }
      if (sortBy === "TITLE_DESC") {
        return b.game.title.localeCompare(a.game.title);
      }
      if (sortBy === "PRICE_DESC") {
        return b.game.currentPrice - a.game.currentPrice;
      }
      if (sortBy === "SCORE_DESC") {
        const scoreA = a.game.dealAnalysis?.dealScore || 0;
        const scoreB = b.game.dealAnalysis?.dealScore || 0;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [items, activeFilter, sortBy, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      base: items.filter((i) => i.game.productClass === "BASE_GAME").length,
      bundle: items.filter((i) => i.game.productClass === "BUNDLE").length,
      dlc: items.filter((i) => ["DLC", "ADD_ON", "EXPANSION", "SEASON_PASS", "CONTENT_PACK"].includes(i.game.productClass)).length,
      favorite: items.filter((i) => i.favorite).length,
      completed: items.filter((i) => i.completed).length,
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
          <Gamepad2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Kütüphaneniz Henüz Boş</h3>
        <p className="mx-auto max-w-md text-sm text-zinc-400 mb-6">
          Sahip olduğunuz Xbox oyunlarını kütüphanenize ekleyerek kişiselleştirilmiş indirim ve DLC fırsatlarını takip edebilirsiniz.
        </p>
        <Link
          href="/firsatlar"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Fırsatları Keşfet
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: "Tümü", count: counts.all },
            { id: "BASE_GAME", label: "Oyunlar", count: counts.base },
            { id: "BUNDLE", label: "Paketler", count: counts.bundle },
            { id: "DLC_ADDON", label: "DLC & Eklentiler", count: counts.dlc },
            { id: "FAVORITE", label: "Favoriler", count: counts.favorite },
            { id: "COMPLETED", label: "Tamamlananlar", count: counts.completed },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === tab.id
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] ${
                  activeFilter === tab.id ? "bg-emerald-700 text-emerald-100" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Kütüphanede ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 sm:w-56 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />

          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="RECENT" className="bg-zinc-900 text-white">Eklenme Tarihi</option>
              <option value="TITLE_ASC" className="bg-zinc-900 text-white">İsim (A-Z)</option>
              <option value="TITLE_DESC" className="bg-zinc-900 text-white">İsim (Z-A)</option>
              <option value="PRICE_DESC" className="bg-zinc-900 text-white">Fiyat (Yüksekten Düşüğe)</option>
              <option value="SCORE_DESC" className="bg-zinc-900 text-white">Fırsat Skoru</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-400 text-sm">
          Seçili filtre kriterlerine uygun oyun bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => {
            const hasDiscount = item.game.discountPercent > 0;
            return (
              <div
                key={item.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 transition-all shadow-sm hover:shadow-md"
              >
                {/* Poster */}
                <Link href={`/oyun/${item.game.slug}`} className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
                  {item.game.imageUrl ? (
                    <Image
                      src={getOptimizedImageUrl(item.game.imageUrl, "card")}
                      alt={item.game.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-700">
                      <Gamepad2 className="h-10 w-10" />
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className="rounded bg-zinc-950/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-mono font-medium text-zinc-300 border border-zinc-800">
                      {item.game.productClass}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {item.favorite && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/90 text-white shadow">
                        <Heart className="h-3.5 w-3.5 fill-current" />
                      </span>
                    )}
                    {item.completed && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/90 text-white shadow">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>

                  {/* Discount / Deal Badge */}
                  {hasDiscount && (
                    <div className="absolute bottom-2 left-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                      -%{item.game.discountPercent}
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between p-3 gap-2">
                  <div>
                    <Link
                      href={`/oyun/${item.game.slug}`}
                      className="text-xs font-semibold text-white hover:text-emerald-400 line-clamp-2 transition-colors"
                      title={item.game.title}
                    >
                      {item.game.title}
                    </Link>
                    {item.game.childRelations && item.game.childRelations.length > 0 && (
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        {item.game.childRelations.length} içerik mevcut
                      </span>
                    )}
                  </div>

                  <div className="border-t border-zinc-800/80 pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">₺{item.game.currentPrice.toFixed(2)}</span>
                      {hasDiscount && (
                        <span className="text-[10px] text-zinc-500 line-through ml-1">
                          ₺{item.game.listPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {item.game.dealAnalysis && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          item.game.dealAnalysis.dealScore >= 75
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : item.game.dealAnalysis.dealScore >= 50
                            ? "bg-blue-950 text-blue-400 border border-blue-800/60"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.game.dealAnalysis.dealScore}/100
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
