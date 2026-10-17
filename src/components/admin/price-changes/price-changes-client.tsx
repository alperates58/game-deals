"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Clock,
  Sparkles,
  Search,
  Filter,
  ExternalLink,
  History,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Star,
  Tag,
  Calendar,
  Layers,
  Gamepad2,
  Store,
  RefreshCw,
  ArrowRight,
  Info,
} from "lucide-react";
import { formatPrice, formatDateTime } from "@/lib/formatters";

interface PriceChangeItem {
  id: string;
  gameId: string;
  game: {
    id: string;
    xboxProductId: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    productClass: string;
    platforms: string[];
    url: string | null;
    historicalLow: number | null;
  };
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  isOnSale: boolean;
  saleEndAt: string | null;
  currency: string;
  observedAt: string;
  previousPrice: number;
  previousListPrice: number;
  previousDiscountPercent: number;
  hasPrevious: boolean;
  difference: number;
  percentChange: number;
  directionType: "drop" | "increase" | "initial" | "unchanged";
  isHistoricalLow: boolean;
}

interface Stats {
  totalRecorded: number;
  changes24h: number;
  activeDealsCount: number;
  historicalLowsRecorded: number;
}

interface TimelineEntry {
  id: string;
  observedAt: string;
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  isOnSale: boolean;
  saleEndAt: string | null;
  currency: string;
  previousPrice: number;
  difference: number;
  percentChange: number;
}

interface InspectGameData {
  id: string;
  xboxProductId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  productClass: string;
  platforms: string[];
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  historicalLow: number | null;
  historicalLowAt: string | null;
  lastSeenAt: string;
  url: string | null;
}

export function PriceChangesClient() {
  const [items, setItems] = useState<PriceChangeItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [direction, setDirection] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Inspect Modal State
  const [inspectGameId, setInspectGameId] = useState<string | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<{
    game: InspectGameData;
    timeline: TimelineEntry[];
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch paginated changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        timeRange,
        direction,
        type,
      });
      if (debouncedSearch) params.set("q", debouncedSearch);

      const res = await fetch(`/api/admin/price-changes?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fiyat değişiklikleri getirilemedi.");
      }

      setItems(data.items || []);
      setStats(data.stats || null);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalItems(data.pagination?.totalItems || 0);
    } catch (err: any) {
      setError(err.message || "Veriler alınırken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, timeRange, direction, type, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch single game history for modal
  const openHistoryModal = async (gameId: string) => {
    setInspectGameId(gameId);
    setInspectLoading(true);
    setInspectData(null);
    try {
      const res = await fetch(`/api/admin/price-changes?gameId=${gameId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fiyat geçmişi yüklenemedi.");
      setInspectData({
        game: data.game,
        timeline: data.timeline || [],
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setInspectLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setInspectGameId(null);
    setInspectData(null);
  };

  const getProductClassBadge = (pClass: string) => {
    switch (pClass) {
      case "BASE_GAME":
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
            OYUN
          </span>
        );
      case "BUNDLE":
        return (
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400 border border-purple-500/20">
            PAKET
          </span>
        );
      case "ADDON":
      case "DLC":
        return (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
            DLC
          </span>
        );
      default:
        return (
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
            {pClass}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Toplam Fiyat Kaydı</span>
            <History className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats ? stats.totalRecorded.toLocaleString("tr-TR") : "..."}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Sistemde arşivlenen tüm fiyat gözlemleri
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Son 24 Saat Değişim</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {stats ? stats.changes24h.toLocaleString("tr-TR") : "..."}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Son 24 saatte kaydedilen yeni fiyatlar
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">İndirim Gözlemleri</span>
            <TrendingDown className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 tracking-tight">
            {stats ? stats.activeDealsCount.toLocaleString("tr-TR") : "..."}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Tarihsel indirimli fiyat kayıtları
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Aktif Tarihi Dip</span>
            <Star className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            {stats ? stats.historicalLowsRecorded.toLocaleString("tr-TR") : "..."}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Şu anda tarihi dipte olan indirimli içerikler
          </div>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Oyun adı veya Xbox Ürün ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium text-zinc-200 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            <span>Yenile</span>
          </button>
        </div>

        {/* Filter Pills / Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60 text-xs">
          {/* Time Range */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 px-2 font-medium">Zaman:</span>
            {[
              { id: "all", label: "Tümü" },
              { id: "today", label: "Bugün" },
              { id: "24h", label: "Son 24 Sa" },
              { id: "7d", label: "Son 7 Gün" },
              { id: "30d", label: "Son 30 Gün" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTimeRange(t.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  timeRange === t.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 px-2 font-medium">Hareket:</span>
            {[
              { id: "all", label: "Tümü" },
              { id: "drop", label: "İndirimler" },
              { id: "historical_low", label: "Tarihi Dip" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDirection(d.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  direction === d.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Product Class Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 px-2 font-medium">Tür:</span>
            {[
              { id: "all", label: "Tüm Türler" },
              { id: "games", label: "Oyunlar" },
              { id: "bundles", label: "Paketler" },
              { id: "dlcs", label: "DLC" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setType(cat.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  type === cat.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Limit selector */}
          <div className="ml-auto flex items-center gap-1 text-[11px] text-zinc-400">
            <span>Kayıt:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-zinc-700"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Table of Price Changes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <span className="text-xs">Fiyat kayıtları yükleniyor...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-zinc-500 text-center">
            <Info className="h-10 w-10 text-zinc-600 mb-1" />
            <p className="text-sm font-medium text-zinc-300">Kayıt Bulunamadı</p>
            <p className="text-xs text-zinc-500 max-w-sm">
              Seçilen filtrelere uygun fiyat değişikliği kaydı bulunmuyor. Filtreleri genişleterek tekrar deneyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-medium">
                  <th className="py-3 px-4">İçerik / Oyun</th>
                  <th className="py-3 px-4">Önceki Fiyat</th>
                  <th className="py-3 px-4">Gözlemlenen Fiyat</th>
                  <th className="py-3 px-4">Değişim / Hareket</th>
                  <th className="py-3 px-4">Gözlem Tarihi</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {items.map((item) => {
                  const isDrop = item.directionType === "drop";
                  const isHike = item.directionType === "increase";
                  const isInitial = item.directionType === "initial" || !item.hasPrevious;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Game Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div className="h-12 w-9 rounded overflow-hidden bg-zinc-800 shrink-0 relative border border-zinc-700/50">
                            {item.game.imageUrl ? (
                              <Image
                                src={item.game.imageUrl}
                                alt={item.game.title}
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <Gamepad2 className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getProductClassBadge(item.game.productClass)}
                              {item.isHistoricalLow && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                                  <Star className="h-2.5 w-2.5 fill-amber-400" />
                                  Tarihi Dip
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/oyun/${item.game.slug}`}
                              target="_blank"
                              className="font-medium text-white hover:text-emerald-400 transition-colors line-clamp-1 text-xs"
                            >
                              {item.game.title}
                            </Link>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ID: {item.game.xboxProductId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Previous Price */}
                      <td className="py-3 px-4 font-mono">
                        {isInitial ? (
                          <span className="text-zinc-500 italic text-[11px]">- (İlk Giriş)</span>
                        ) : (
                          <div>
                            <span className="text-zinc-400">
                              {formatPrice(item.previousPrice)} ₺
                            </span>
                            {item.previousDiscountPercent > 0 && (
                              <span className="ml-1 text-[10px] text-zinc-500">
                                (%{item.previousDiscountPercent})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Current / New Price */}
                      <td className="py-3 px-4 font-mono">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-semibold ${
                                isDrop
                                  ? "text-emerald-400"
                                  : isHike
                                  ? "text-rose-400"
                                  : "text-white"
                              }`}
                            >
                              {item.currentPrice === 0
                                ? "ÜCRETSİZ"
                                : `${formatPrice(item.currentPrice)} ₺`}
                            </span>
                            {item.discountPercent > 0 && (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400">
                                -%{item.discountPercent}
                              </span>
                            )}
                          </div>
                          {item.listPrice > item.currentPrice && (
                            <span className="line-through text-zinc-500 text-[10px]">
                              {formatPrice(item.listPrice)} ₺
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delta / Movement */}
                      <td className="py-3 px-4">
                        {isDrop ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                            <TrendingDown className="h-3 w-3" />
                            <span>
                              {formatPrice(Math.abs(item.difference))} ₺ Düşüş ({item.percentChange}%)
                            </span>
                          </div>
                        ) : isHike ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium text-[11px]">
                            <TrendingUp className="h-3 w-3" />
                            <span>
                              +{formatPrice(Math.abs(item.difference))} ₺ Artış (+{item.percentChange}%)
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-[11px]">
                            Baz Fiyat Kaydı
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                          <span>{formatDateTime(item.observedAt)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openHistoryModal(item.gameId)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-600/20 hover:text-emerald-400 text-zinc-300 transition-colors"
                            title="Tüm Fiyat Geçmişi Çizelgesini İncele"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          <Link
                            href={`/oyun/${item.game.slug}`}
                            target="_blank"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                            title="Sitede İncele"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>

                          {item.game.url && (
                            <Link
                              href={item.game.url}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              title="Xbox Mağazasında Gör"
                            >
                              <Store className="h-3.5 w-3.5 text-emerald-500" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Pagination */}
        {!loading && items.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-zinc-800 text-xs text-zinc-400 bg-zinc-950/40">
            <div>
              Toplam <span className="font-semibold text-white">{totalItems.toLocaleString("tr-TR")}</span> kayıt
              (Sayfa <span className="font-semibold text-white">{page}</span> / {totalPages})
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-200 transition-colors font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Önceki</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-200 transition-colors font-medium"
              >
                <span>Sonraki</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Single Game Price History Modal */}
      {inspectGameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-3">
                <div className="h-12 w-9 rounded overflow-hidden bg-zinc-800 relative border border-zinc-700 shrink-0">
                  {inspectData?.game?.imageUrl ? (
                    <Image
                      src={inspectData.game.imageUrl}
                      alt={inspectData.game.title}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <Gamepad2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    {inspectData?.game && getProductClassBadge(inspectData.game.productClass)}
                    <span className="text-xs text-zinc-400 font-mono">
                      {inspectData?.game?.xboxProductId}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">
                    {inspectData?.game?.title || "Oyun Fiyat Geçmişi"}
                  </h3>
                </div>
              </div>

              <button
                onClick={closeHistoryModal}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5">
              {inspectLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
                  <span className="text-xs">Zaman çizelgesi hesaplanıyor...</span>
                </div>
              ) : inspectData ? (
                <>
                  {/* Game Price Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <span className="text-zinc-500 block mb-1">Güncel Fiyat</span>
                      <span className="text-base font-bold text-white">
                        {formatPrice(inspectData.game.currentPrice)} ₺
                      </span>
                    </div>

                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <span className="text-zinc-500 block mb-1">Liste Fiyatı</span>
                      <span className="text-base font-bold text-zinc-300">
                        {formatPrice(inspectData.game.listPrice)} ₺
                      </span>
                    </div>

                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <span className="text-zinc-500 block mb-1">Tarihi En Düşük</span>
                      <span className="text-base font-bold text-amber-400">
                        {inspectData.game.historicalLow !== null
                          ? `${formatPrice(inspectData.game.historicalLow)} ₺`
                          : "-"}
                      </span>
                    </div>

                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                      <span className="text-zinc-500 block mb-1">Toplam Gözlem</span>
                      <span className="text-base font-bold text-emerald-400">
                        {inspectData.timeline.length} kayıt
                      </span>
                    </div>
                  </div>

                  {/* Timeline Table */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
                      <History className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Fiyat Değişim Çizelgesi ({inspectData.timeline.length})</span>
                    </h4>

                    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-medium">
                            <th className="py-2.5 px-3">Gözlem Tarihi</th>
                            <th className="py-2.5 px-3">Fiyat</th>
                            <th className="py-2.5 px-3">İndirim Oranı</th>
                            <th className="py-2.5 px-3">Öncekine Göre Fark</th>
                            <th className="py-2.5 px-3">Kampanya Bitişi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                          {inspectData.timeline.map((entry, idx) => {
                            const isOldest = idx === inspectData.timeline.length - 1;
                            const isDrop = entry.difference < 0;
                            const isHike = entry.difference > 0;

                            return (
                              <tr key={entry.id} className="hover:bg-zinc-900/50">
                                <td className="py-2.5 px-3 whitespace-nowrap text-zinc-300 font-mono text-[11px]">
                                  {formatDateTime(entry.observedAt)}
                                </td>

                                <td className="py-2.5 px-3 font-semibold text-white">
                                  {entry.currentPrice === 0 ? "Ücretsiz" : `${formatPrice(entry.currentPrice)} ₺`}
                                </td>

                                <td className="py-2.5 px-3">
                                  {entry.discountPercent > 0 ? (
                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                      -%{entry.discountPercent}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500 text-[11px]">Normal Fiyat</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3">
                                  {isOldest ? (
                                    <span className="text-zinc-500 text-[11px] italic">İlk Kayıt</span>
                                  ) : isDrop ? (
                                    <span className="text-emerald-400 font-medium text-[11px]">
                                      {formatPrice(entry.difference)} ₺ ({entry.percentChange}%)
                                    </span>
                                  ) : isHike ? (
                                    <span className="text-rose-400 font-medium text-[11px]">
                                      +{formatPrice(entry.difference)} ₺ (+{entry.percentChange}%)
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500 text-[11px]">Fiyat Aynı</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                                  {entry.saleEndAt ? formatDateTime(entry.saleEndAt) : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Geçmiş verisi bulunamadı.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-950">
              {inspectData?.game?.slug && (
                <Link
                  href={`/oyun/${inspectData.game.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  <span>Sitedeki Sayfasını Aç</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}

              <button
                onClick={closeHistoryModal}
                className="ml-auto px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
