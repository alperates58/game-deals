"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Loader2, Sparkles, Tag, ArrowRight } from "lucide-react";
import { ProductClass } from "@prisma/client";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";

interface SearchResultItem {
  id: string;
  slug: string;
  title: string;
  imageUrl?: string | null;
  publisher?: string | null;
  productClass: ProductClass;
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  currency: string;
  dealScore?: number | null;
  verdict?: string | null;
}

export function LiveSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced live fetch
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setIsOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Live search failed:", err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim().length > 0) {
        router.push(`/firsatlar?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        const item = results[selectedIndex];
        setIsOpen(false);
        router.push(`/oyun/${item.slug}`);
      } else if (query.trim().length > 0) {
        setIsOpen(false);
        router.push(`/firsatlar?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const getClassBadge = (pClass: ProductClass) => {
    switch (pClass) {
      case "BASE_GAME":
        return <span className="rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.5 text-[9px] font-semibold">Oyun</span>;
      case "BUNDLE":
        return <span className="rounded bg-purple-950/80 text-purple-300 border border-purple-800/40 px-1.5 py-0.5 text-[9px] font-semibold">Paket</span>;
      case "DLC":
        return <span className="rounded bg-blue-950/80 text-blue-300 border border-blue-800/40 px-1.5 py-0.5 text-[9px] font-semibold">DLC</span>;
      case "SEASON_PASS":
        return <span className="rounded bg-amber-950/80 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 text-[9px] font-semibold">Sezon Bileti</span>;
      case "EXPANSION":
        return <span className="rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 text-[9px] font-semibold">Genişletme</span>;
      default:
        return <span className="rounded bg-zinc-800 text-zinc-300 border border-zinc-700 px-1.5 py-0.5 text-[9px] font-semibold">Eklenti</span>;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-xs sm:max-w-sm lg:max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Oyun veya DLC ara..."
          className="h-9 sm:h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-8 sm:pl-9 pr-8 sm:pr-9 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-emerald-400 pointer-events-none" />
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full right-0 sm:left-0 sm:right-0 mt-2 z-50 w-[min(340px,calc(100vw-32px))] sm:w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-md">
          {results.length > 0 ? (
            <div className="divide-y divide-zinc-800/60 max-h-[420px] overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-950/50 flex items-center justify-between">
                <span>Veritabanı Sonuçları ({results.length})</span>
                <span className="text-zinc-400">↑↓ seç, Enter git</span>
              </div>

              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/oyun/${item.slug}`);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-zinc-800/90" : "hover:bg-zinc-800/50"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-zinc-950 border border-zinc-800">
                      {item.imageUrl ? (
                        <Image
                          src={getOptimizedImageUrl(item.imageUrl, "thumb")}
                          alt={item.title}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[8px] text-zinc-600">
                          Resim Yok
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-zinc-100">
                          {item.title}
                        </span>
                        {getClassBadge(item.productClass)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        <span className="font-bold text-emerald-400">
                          {item.currentPrice.toLocaleString("tr-TR")} {item.currency}
                        </span>
                        {item.discountPercent > 0 && (
                          <span className="text-zinc-400 line-through text-[10px]">
                            {item.listPrice.toLocaleString("tr-TR")} {item.currency}
                          </span>
                        )}
                        {item.discountPercent > 0 && (
                          <span className="rounded bg-emerald-950 px-1 py-0.2 text-[10px] font-bold text-emerald-400">
                            %{item.discountPercent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/firsatlar?q=${encodeURIComponent(query.trim())}`);
                }}
                className="p-2.5 text-center text-xs font-medium text-emerald-400 hover:bg-zinc-800/80 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>&ldquo;{query}&rdquo; için tüm sonuçları gör</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ) : !isLoading ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              <p className="font-semibold text-zinc-300">Sonuç Bulunamadı</p>
              <p className="mt-1 text-[11px] text-zinc-400">
                &ldquo;{query}&rdquo; ile eşleşen oyun veya eklenti bulunamadı.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
