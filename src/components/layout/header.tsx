import Link from "next/link";
import { Gamepad2, Sparkles, TrendingDown, Clock, Layers } from "lucide-react";
import { LiveSearch } from "./live-search";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Logo and Nav */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-950/50 group-hover:bg-emerald-500 transition-colors">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                Xbox Fırsat
              </span>
              <span className="hidden sm:inline-block ml-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                TR
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Ana Sayfa
            </Link>
            <Link
              href="/firsatlar"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              Tüm Fırsatlar
            </Link>
            <Link
              href="/tarihi-dip"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              Tarihi Dip
            </Link>
            <Link
              href="/eklentiler"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              DLC & Eklentiler
            </Link>
          </nav>
        </div>

        {/* Live Search */}
        <div className="flex-1 flex justify-end max-w-md">
          <LiveSearch />
        </div>

        {/* Mobile Nav Icons */}
        <div className="flex lg:hidden items-center gap-1 shrink-0">
          <Link
            href="/firsatlar"
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Fırsatlar"
          >
            <TrendingDown className="h-5 w-5" />
          </Link>
          <Link
            href="/eklentiler"
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Eklentiler"
          >
            <Layers className="h-5 w-5" />
          </Link>
          <Link
            href="/tarihi-dip"
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Tarihi Dip"
          >
            <Clock className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
