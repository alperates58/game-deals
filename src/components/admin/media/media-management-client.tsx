"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Image as ImageIcon,
  Film,
  Search,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Gamepad2,
  Filter,
  Sparkles,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";

export interface MediaGameItem {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  productClass: string;
  publisher: string | null;
  currentPrice?: number;
  discountPercent?: number;
}

export interface VideoMediaItem {
  id: string;
  type: string;
  title: string;
  url: string;
  provider: string;
  game: {
    id: string;
    title: string;
    slug: string;
  };
}

interface MediaManagementClientProps {
  initialGames: MediaGameItem[];
  missingGames: MediaGameItem[];
  videoMediaList: VideoMediaItem[];
  stats: {
    totalWithImage: number;
    totalMissingImage: number;
    totalVideoMedia: number;
  };
}

export function MediaManagementClient({
  initialGames,
  missingGames,
  videoMediaList,
  stats,
}: MediaManagementClientProps) {
  const [activeTab, setActiveTab] = useState<"posters" | "missing" | "videos">("posters");
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");

  const filteredPosters = useMemo(() => {
    return initialGames.filter((g) => {
      const matchesSearch =
        !search.trim() ||
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.slug.toLowerCase().includes(search.toLowerCase()) ||
        (g.publisher && g.publisher.toLowerCase().includes(search.toLowerCase()));

      const matchesClass =
        selectedClass === "ALL" || g.productClass === selectedClass;

      return matchesSearch && matchesClass;
    });
  }, [initialGames, search, selectedClass]);

  const filteredMissing = useMemo(() => {
    return missingGames.filter((g) => {
      return (
        !search.trim() ||
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.slug.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [missingGames, search]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-400">Katalog Afişleri (CDN)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-white">{stats.totalWithImage}</span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" />
                %99.8 Aktif
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">Resmi Xbox Mağaza CDN varlıkları</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ImageIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-400">Eksik Görsel Denetimi</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-amber-400">{stats.totalMissingImage}</span>
              <span className="text-[11px] text-zinc-400">oyun görsel bekliyor</span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">Manuel afiş URL ezmesi eklenebilir</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-400">Video Fragmanlar & Oynanış</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-white">{stats.totalVideoMedia}</span>
              <span className="text-[11px] text-zinc-400">kayıtlı harici medya</span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">YouTube fragman ve oynanış videoları</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Film className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Tabs and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("posters")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "posters"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Katalog Afişleri ({stats.totalWithImage})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("missing")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "missing"
                ? "bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>Eksik Afişler ({stats.totalMissingImage})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("videos")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "videos"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Video Fragmanlar ({stats.totalVideoMedia})</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Oyun veya yayıncı ara..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {activeTab === "posters" && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">Tüm Sınıflar</option>
              <option value="BASE_GAME">Ana Oyunlar</option>
              <option value="BUNDLE">Paketler</option>
              <option value="DLC">DLC / Eklenti</option>
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: POSTERS GALLERY */}
      {activeTab === "posters" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredPosters.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-zinc-500">
                Arama kriterlerine uygun katalog görseli bulunamadı.
              </div>
            ) : (
              filteredPosters.map((g) => (
                <div
                  key={g.id}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-all shadow-sm"
                >
                  <div className="relative aspect-[3/4] bg-zinc-950 overflow-hidden">
                    {g.imageUrl ? (
                      <Image
                        src={getOptimizedImageUrl(g.imageUrl, "thumb")}
                        alt={g.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-zinc-700">
                        <Gamepad2 className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <span className="absolute top-2 left-2 rounded bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white border border-zinc-700/50">
                      {g.productClass}
                    </span>

                    {g.discountPercent && g.discountPercent > 0 ? (
                      <span className="absolute top-2 right-2 rounded bg-emerald-500/90 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-zinc-950">
                        -%{g.discountPercent}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-2.5 space-y-1">
                    <p className="font-semibold text-white text-xs truncate group-hover:text-emerald-400 transition-colors">
                      {g.title}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {g.publisher || "Bilinmeyen Yayıncı"}
                    </p>
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                      <a
                        href={g.imageUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>CDN</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      <Link
                        href={`/admin/catalog/${g.id}`}
                        className="text-zinc-400 hover:text-white font-medium"
                      >
                        Detay
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MISSING IMAGES AUDIT */}
      {activeTab === "missing" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-300 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Görseli Eksik Olan Oyunlar Denetimi</p>
              <p className="text-zinc-400 mt-1">
                Aşağıdaki {missingGames.length} oyunun Microsoft Store API&apos;sinden afiş verisi dönmemiştir.
                Oyun detay sayfasına giderek &quot;Manuel Ezme (Override)&quot; ile harici bir afiş URL&apos;si ekleyebilirsiniz.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Oyun Başlığı</th>
                  <th className="py-3 px-4">Sınıf</th>
                  <th className="py-3 px-4">Yayıncı</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredMissing.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      Tebrikler! Görseli eksik hiçbir oyun bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredMissing.map((g) => (
                    <tr key={g.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{g.title}</td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                          {g.productClass}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{g.publisher || "-"}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">{g.slug}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/catalog/${g.id}`}
                          className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                        >
                          <span>Afiş Ekle</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VIDEO TRAILERS & GAMEPLAY */}
      {activeTab === "videos" && (
        <div className="space-y-4">
          {videoMediaList.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center space-y-3">
              <Film className="h-10 w-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">Henüz Harici Video / Fragman Eklenmedi</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Katalogdaki oyunlara ait resmi YouTube fragmanları, oynanış videoları ve incelemeler
                bu alanda yönetilir. Herhangi bir oyunun detay sayfasından video bağlantısı tanımlayabilirsiniz.
              </p>
              <div className="pt-2">
                <Link
                  href="/admin/catalog"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span>Katalogdan Oyun Seç</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {videoMediaList.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col justify-between"
                >
                  <div className="aspect-video bg-zinc-950 relative flex items-center justify-center">
                    <Film className="h-8 w-8 text-zinc-600 mb-1" />
                    <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {m.type}
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="font-semibold text-white text-xs truncate">{m.game.title}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{m.title}</p>
                    <div className="pt-2 flex justify-between items-center text-[10px]">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>İzle</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Link href={`/admin/catalog/${m.game.id}`} className="text-zinc-400 hover:text-white">
                        Oyuna Git
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
