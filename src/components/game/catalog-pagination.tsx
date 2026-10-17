import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

export function CatalogPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  basePath,
  searchParams = {},
}: CatalogPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  // Helper to generate the URL for a specific page number
  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams();

    // Preserve all existing search params except 'page'
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key !== "page" && value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      }
    });

    if (pageNumber > 1) {
      params.set("page", pageNumber.toString());
    }

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  // Determine window of page numbers to show
  // e.g. [1, ..., 4, 5, 6, ..., 20]
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Always include first page
    pages.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push("ellipsis");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("ellipsis");
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-zinc-800/80">
      {/* Information text */}
      <p className="text-xs sm:text-sm text-zinc-400 order-2 sm:order-1 text-center sm:text-left">
        Toplam <span className="font-semibold text-white">{totalItems.toLocaleString("tr-TR")}</span> içerikten{" "}
        <span className="font-semibold text-white">{startItem.toLocaleString("tr-TR")} - {endItem.toLocaleString("tr-TR")}</span> arası gösteriliyor
        <span className="hidden md:inline text-zinc-500"> (Sayfa {currentPage} / {totalPages})</span>
      </p>

      {/* Pagination controls */}
      <nav aria-label="Sayfalama" className="flex items-center gap-1 order-1 sm:order-2">
        {/* First Page Button */}
        {currentPage > 1 ? (
          <Link
            href={createPageUrl(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
            title="İlk Sayfa"
            aria-label="İlk Sayfa"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-zinc-700 cursor-not-allowed">
            <ChevronsLeft className="h-4 w-4" />
          </span>
        )}

        {/* Previous Page Button */}
        {currentPage > 1 ? (
          <Link
            href={createPageUrl(currentPage - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
            title="Önceki Sayfa"
            aria-label="Önceki Sayfa"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-zinc-700 cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {/* Number Buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, idx) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-9 w-7 items-center justify-center text-xs text-zinc-600 select-none"
                >
                  •••
                </span>
              );
            }

            const isActive = page === currentPage;

            return isActive ? (
              <span
                key={page}
                className="flex h-9 min-w-9 px-3 items-center justify-center rounded-lg bg-emerald-600 border border-emerald-500 text-xs font-bold text-white shadow-sm"
                aria-current="page"
              >
                {page}
              </span>
            ) : (
              <Link
                key={page}
                href={createPageUrl(page)}
                className="flex h-9 min-w-9 px-3 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
              >
                {page}
              </Link>
            );
          })}
        </div>

        {/* Next Page Button */}
        {currentPage < totalPages ? (
          <Link
            href={createPageUrl(currentPage + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
            title="Sonraki Sayfa"
            aria-label="Sonraki Sayfa"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-zinc-700 cursor-not-allowed">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}

        {/* Last Page Button */}
        {currentPage < totalPages ? (
          <Link
            href={createPageUrl(totalPages)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
            title="Son Sayfa"
            aria-label="Son Sayfa"
          >
            <ChevronsRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-zinc-700 cursor-not-allowed">
            <ChevronsRight className="h-4 w-4" />
          </span>
        )}
      </nav>
    </div>
  );
}
