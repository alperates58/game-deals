"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Gamepad2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";
import { ProductClass } from "@prisma/client";

interface GameRow {
  id: string;
  title: string;
  slug: string;
  productClass: ProductClass;
  developer: string | null;
  publisher: string | null;
  imageUrl: string | null;
  isActive: boolean;
  updatedAt: string;
  hasManualOverride: boolean;
  counts: {
    childRelationships: number;
    parentRelationships: number;
    externalRatings: number;
    subscriptions: number;
  };
  price: {
    originalPrice: number;
    currentPrice: number;
    discountPercent: number;
    currency: string;
    isFree: boolean;
  } | null;
}

export function CatalogTable() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [productClass, setProductClass] = useState<string>("ALL");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (productClass !== "ALL") params.set("productClass", productClass);
      if (hasDiscount) params.set("hasDiscount", "true");
      if (hasOverride) params.set("hasOverride", "true");

      const res = await fetch(`/api/admin/catalog?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setGames(data.games || []);
        setTotalPages(data.pagination.totalPages || 1);
        setTotal(data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [page, debouncedSearch, productClass, hasDiscount, hasOverride]);

  const getClassBadge = (pc: ProductClass) => {
    switch (pc) {
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
      case "DLC":
        return (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
            DLC
          </span>
        );
      default:
        return (
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
            DİĞER
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Başlık veya slug ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={productClass}
            onChange={(e) => {
              setProductClass(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Tüm Sınıflar</option>
            <option value="BASE_GAME">Ana Oyunlar</option>
            <option value="BUNDLE">Paketler (Bundles)</option>
            <option value="DLC">DLC & Eklentiler</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDiscount}
              onChange={(e) => {
                setHasDiscount(e.target.checked);
                setPage(1);
              }}
              className="rounded bg-zinc-950 border-zinc-700 text-emerald-600 focus:ring-0"
            />
            <span>Sadece İndirimdekiler</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hasOverride}
              onChange={(e) => {
                setHasOverride(e.target.checked);
                setPage(1);
              }}
              className="rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-0"
            />
            <span className="text-amber-400">Manuel Ezilenler</span>
          </label>

          <button
            type="button"
            onClick={fetchGames}
            disabled={loading}
            className="rounded-lg bg-zinc-800 hover:bg-zinc-700 p-2 text-zinc-300 transition-colors"
            title="Yenile"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span>Toplam {total} kayıt bulundu</span>
        <span>Sayfa {page} / {totalPages}</span>
      </div>

      {/* Catalog Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Oyun / Başlık</th>
              <th className="py-3 px-4">Sınıf</th>
              <th className="py-3 px-4">Mevcut Fiyat</th>
              <th className="py-3 px-4">İndirim</th>
              <th className="py-3 px-4">İlişkiler</th>
              <th className="py-3 px-4">Manuel Ezme</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Katalog yükleniyor...
                </td>
              </tr>
            ) : games.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  Aramanıza uygun ürün bulunamadı.
                </td>
              </tr>
            ) : (
              games.map((g) => (
                <tr key={g.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {g.imageUrl ? (
                        <img
                          src={g.imageUrl}
                          alt={g.title}
                          className="h-10 w-8 object-cover rounded bg-zinc-800 shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-8 rounded bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-600">
                          <Gamepad2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 max-w-[280px]">
                        <p className="font-semibold text-white truncate" title={g.title}>
                          {g.title}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{g.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{getClassBadge(g.productClass)}</td>
                  <td className="py-3 px-4 font-mono font-medium">
                    {g.price ? (
                      g.price.isFree ? (
                        <span className="text-emerald-400 font-semibold">ÜCRETSİZ</span>
                      ) : (
                        <span className="text-white">₺{g.price.currentPrice.toFixed(2)}</span>
                      )
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {g.price && g.price.discountPercent > 0 ? (
                      <span className="inline-flex rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                        -%{g.price.discountPercent}
                      </span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                      <span>+{g.counts.childRelationships} içerik</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {g.hasManualOverride ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
                        <SlidersHorizontal className="h-3 w-3" />
                        Ezilmiş
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-[10px]">Orijinal Mağaza</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/catalog/${g.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors"
                    >
                      <span>Yönet</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-400">
            Sayfa <span className="font-semibold text-white">{page}</span> / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
