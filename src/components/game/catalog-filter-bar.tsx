import Link from "next/link";
import { Gamepad2, Package, Layers, TrendingDown, Sparkles, Clock, ArrowDownWideNarrow, ArrowUpNarrowWide, DollarSign } from "lucide-react";

export interface CatalogFilterState {
  type?: string; // "all" | "game" | "bundle" | "addon"
  platform?: string; // "all" | "series" | "one"
  minDiscount?: string; // "0" | "50" | "75" | "90"
  maxPrice?: string; // "" | "100" | "250"
  sort?: string; // "dealScore" | "discount" | "priceChange" | "priceAsc" | "priceDesc"
  q?: string;
}

interface CatalogFilterBarProps {
  basePath: string; // e.g. "/firsatlar" or "/tarihi-dip" or "/eklentiler"
  filters: CatalogFilterState;
  showTypeTabs?: boolean;
}

export function CatalogFilterBar({
  basePath,
  filters,
  showTypeTabs = true,
}: CatalogFilterBarProps) {
  const currentType = filters.type || "all";
  const currentPlatform = filters.platform || "all";
  const currentMinDisc = filters.minDiscount || "0";
  const currentMaxPrice = filters.maxPrice || "";
  const currentSort = filters.sort || "dealScore";
  const currentQ = filters.q || "";

  // Helper to build URL with preserved query parameters
  const buildUrl = (overrides: Partial<CatalogFilterState>) => {
    const params = new URLSearchParams();
    if (currentQ) params.set("q", currentQ);

    const merged = {
      type: currentType,
      platform: currentPlatform,
      minDiscount: currentMinDisc,
      maxPrice: currentMaxPrice,
      sort: currentSort,
      ...overrides,
    };

    if (merged.type && merged.type !== "all") params.set("type", merged.type);
    if (merged.platform && merged.platform !== "all") params.set("platform", merged.platform);
    if (merged.minDiscount && merged.minDiscount !== "0") params.set("minDiscount", merged.minDiscount);
    if (merged.maxPrice) params.set("maxPrice", merged.maxPrice);
    if (merged.sort && merged.sort !== "dealScore") params.set("sort", merged.sort);

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  return (
    <div className="flex flex-col gap-3 py-2">
      {/* Top Row: Type Tabs & Sort Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Main Product Type Tabs */}
        {showTypeTabs && (
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
            <Link
              href={buildUrl({ type: "all" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                currentType === "all"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <span>Tümü</span>
            </Link>

            <Link
              href={buildUrl({ type: "game" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                currentType === "game"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Oyunlar</span>
            </Link>

            <Link
              href={buildUrl({ type: "bundle" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                currentType === "bundle"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Paketler</span>
            </Link>

            <Link
              href={buildUrl({ type: "addon" })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
                currentType === "addon"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>DLC & Eklentiler</span>
            </Link>
          </div>
        )}

        {/* Sort Selector Buttons */}
        <div className="flex flex-wrap items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
          <Link
            href={buildUrl({ sort: "dealScore" })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              currentSort === "dealScore"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Fırsat Puanına Göre"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>En İyi Fırsat</span>
          </Link>

          <Link
            href={buildUrl({ sort: "discount" })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              currentSort === "discount"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
            title="En Yüksek İndirim Oranına Göre"
          >
            <TrendingDown className="h-3.5 w-3.5" />
            <span>En Yüksek İndirim</span>
          </Link>

          <Link
            href={buildUrl({ sort: "priceChange" })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              currentSort === "priceChange"
                ? "bg-blue-950 text-blue-300 border border-blue-800/60 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
            title="En Son Fiyatı Düşen veya Değişen Oyunlar"
          >
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            <span>Son Fiyatı Değişenler</span>
          </Link>

          <Link
            href={buildUrl({ sort: "priceAsc" })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              currentSort === "priceAsc"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Fiyat: En Düşükten En Yükseğe"
          >
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">En Ucuz</span>
          </Link>

          <Link
            href={buildUrl({ sort: "priceDesc" })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
              currentSort === "priceDesc"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Fiyat: En Yüksekten En Düşüğe"
          >
            <ArrowUpNarrowWide className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">En Pahalı</span>
          </Link>
        </div>
      </div>

      {/* Bottom Row: Platform Pills, Percentage Discount Pills & Budget Pills */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* Platform Selector Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1">
          <span className="text-[11px] text-zinc-500 font-medium px-2 hidden sm:inline">Platform:</span>
          {[
            { value: "all", label: "Tüm Konsollar" },
            { value: "series", label: "Xbox Series X|S" },
            { value: "one", label: "Xbox One" },
          ].map((item) => (
            <Link
              key={item.value}
              href={buildUrl({ platform: item.value })}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] ${
                currentPlatform === item.value
                  ? "bg-emerald-600 text-white font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Discount Rate Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1">
          <span className="text-[11px] text-zinc-500 font-medium px-2 hidden sm:inline">İndirim:</span>
          {[
            { value: "0", label: "Tümü" },
            { value: "50", label: "%50+" },
            { value: "75", label: "%75+" },
            { value: "90", label: "%90+" },
          ].map((item) => (
            <Link
              key={item.value}
              href={buildUrl({ minDiscount: item.value })}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] ${
                currentMinDisc === item.value
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Budget / Price Cap Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1">
          <span className="text-[11px] text-zinc-500 font-medium px-2 hidden sm:inline">Bütçe:</span>
          {[
            { value: "", label: "Tüm Fiyatlar" },
            { value: "100", label: "100 ₺ Altı" },
            { value: "250", label: "250 ₺ Altı" },
          ].map((item) => (
            <Link
              key={item.value}
              href={buildUrl({ maxPrice: item.value })}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium text-[11px] ${
                currentMaxPrice === item.value
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
