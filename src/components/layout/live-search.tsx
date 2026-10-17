"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Loader2, Sparkles, Tag, ArrowRight, X } from "lucide-react";
import { ProductClass } from "@prisma/client";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";
import { formatPrice } from "@/lib/formatters";

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

export interface LiveSearchProps {
  onItemSelect?: () => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  dropdownAlign?: "auto" | "full" | "right";
}

export function LiveSearch({
  onItemSelect,
  className,
  placeholder = "Oyun, paket veya DLC ara...",
  autoFocus = false,
  dropdownAlign = "auto",
}: LiveSearchProps = {}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const pathname = usePathname();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Automatically reset search on route change
  useEffect(() => {
    setIsOpen(false);
    setIsFocused(false);
    setQuery("");
    setResults([]);
    inputRef.current?.blur();
  }, [pathname]);

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
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=10`, {
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
    }, 220);

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
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Form submit (Enter or mobile search button)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (isOpen && selectedIndex >= 0 && selectedIndex < results.length) {
      const item = results[selectedIndex];
      setIsOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();
      onItemSelect?.();
      router.push(`/oyun/${item.slug}`);
      return;
    }

    setIsOpen(false);
    setIsFocused(false);
    inputRef.current?.blur();
    onItemSelect?.();
    router.push(`/firsatlar?q=${encodeURIComponent(trimmed)}`);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const getClassBadge = (pClass: ProductClass) => {
    switch (pClass) {
      case "BASE_GAME":
        return <span className="rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-bold shrink-0">Oyun</span>;
      case "BUNDLE":
        return <span className="rounded bg-purple-950/90 text-purple-300 border border-purple-700/50 px-2 py-0.5 text-[10px] font-bold shrink-0">Paket</span>;
      case "DLC":
        return <span className="rounded bg-blue-950/90 text-blue-300 border border-blue-700/50 px-2 py-0.5 text-[10px] font-bold shrink-0">DLC</span>;
      case "SEASON_PASS":
        return <span className="rounded bg-amber-950/90 text-amber-300 border border-amber-700/50 px-2 py-0.5 text-[10px] font-bold shrink-0">Sezon Bileti</span>;
      case "EXPANSION":
        return <span className="rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/50 px-2 py-0.5 text-[10px] font-bold shrink-0">Genişletme</span>;
      default:
        return <span className="rounded bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold shrink-0">Eklenti</span>;
    }
  };

  return (
    <div
      ref={containerRef}
      className={
        className ||
        `relative w-full transition-all duration-300 ease-out ${
          isFocused ? "max-w-md lg:max-w-xl" : "max-w-xs sm:max-w-sm lg:max-w-md"
        }`
      }
    >
      <form onSubmit={handleSubmit} className="relative group">
        {/* Search Icon */}
        <Search
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors pointer-events-none ${
            isFocused ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-300"
          }`}
        />

        {/* Input: Large text-sm font, comfortable height and padding, clear contrast */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (results.length > 0 || query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            // Keep focused true if dropdown is open to avoid snap transition
            if (!isOpen) {
              setIsFocused(false);
            }
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="h-10 sm:h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-10 text-sm font-medium text-white placeholder-zinc-400 focus:border-emerald-500 focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
        />

        {/* Clear or Loading Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400 pointer-events-none" />
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Aramayı Temizle"
              aria-label="Aramayı Temizle"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </form>

      {/* Dropdown Menu - Perfectly aligned, full-width or comfortable dropdown width */}
      {isOpen && query.trim().length >= 2 && (
        <div
          className={`absolute top-full mt-2 z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/98 backdrop-blur-xl shadow-2xl ${
            dropdownAlign === "full"
              ? "left-0 right-0 w-full"
              : dropdownAlign === "right"
              ? "right-0 w-[calc(100vw-32px)] sm:w-[500px] md:w-[560px] max-w-[94vw]"
              : "left-0 right-0 w-full min-w-[340px] sm:min-w-[440px] md:min-w-[500px]"
          }`}
        >
          {results.length > 0 ? (
            <div className="divide-y divide-zinc-800/60 max-h-[480px] overflow-y-auto">
              <div className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/80 flex items-center justify-between">
                <span>Eşleşen Sonuçlar ({results.length})</span>
                <span className="text-[10px] text-zinc-500 font-normal">↑↓ ile seç, Enter ile git</span>
              </div>

              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <Link
                    key={item.id}
                    href={`/oyun/${item.slug}`}
                    onClick={() => {
                      setIsOpen(false);
                      setIsFocused(false);
                      inputRef.current?.blur();
                      onItemSelect?.();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center gap-3.5 p-3 transition-colors ${
                      isSelected ? "bg-zinc-850" : "hover:bg-zinc-900/80"
                    }`}
                  >
                    {/* Thumbnail Poster */}
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm">
                      {item.imageUrl ? (
                        <Image
                          src={getOptimizedImageUrl(item.imageUrl, "thumb")}
                          alt={item.title}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-zinc-600 font-semibold">
                          Görsel Yok
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-zinc-100 hover:text-emerald-400 transition-colors">
                          {item.title}
                        </span>
                        {getClassBadge(item.productClass)}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-xs text-zinc-400 truncate max-w-[220px]">
                          {item.publisher || "Xbox Store"}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.discountPercent > 0 && (
                            <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 text-[11px] font-extrabold text-emerald-400">
                              -%{item.discountPercent}
                            </span>
                          )}
                          <span className="font-extrabold text-emerald-400 text-sm">
                            {formatPrice(item.currentPrice)} {item.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              <Link
                href={`/firsatlar?q=${encodeURIComponent(query.trim())}`}
                onClick={() => {
                  setIsOpen(false);
                  setIsFocused(false);
                  inputRef.current?.blur();
                  onItemSelect?.();
                }}
                className="p-3 text-center text-xs font-semibold text-emerald-400 hover:bg-zinc-900/80 flex items-center justify-center gap-2 transition-colors border-t border-zinc-800/80"
              >
                <span>&ldquo;{query}&rdquo; için tüm sonuçları gör</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : !isLoading ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              <p className="font-bold text-zinc-300 text-sm">Sonuç Bulunamadı</p>
              <p className="mt-1 text-xs text-zinc-400">
                &ldquo;{query}&rdquo; ile eşleşen oyun, paket veya eklenti bulunamadı.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
