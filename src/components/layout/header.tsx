import Link from "next/link";
import {
  Sparkles,
  TrendingDown,
  Clock,
  Layers,
  Bell,
  Settings,
  LogIn,
  Gamepad2,
} from "lucide-react";
import { LiveSearch } from "./live-search";
import { BrandLogo } from "./brand-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import { MobileNav } from "./mobile-nav";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/90 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 gap-2 sm:gap-4">
        {/* Left: Hamburger (Mobile) + Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <MobileNav user={user} />

          <BrandLogo />

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 ml-2">
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

        {/* Center / Right: Live Search */}
        <div className="flex-1 flex justify-end max-w-xs sm:max-w-sm lg:max-w-md min-w-0">
          <LiveSearch />
        </div>

        {/* Right: User / Auth Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/alarmlar"
                className="hidden md:flex items-center gap-1.5 rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                title="Fiyat Alarmları"
              >
                <Bell className="h-4 w-4" />
              </Link>
              <Link
                href="/kutuphane"
                className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />
                Kütüphanem
              </Link>
              {user.role === Role.OWNER && (
                <Link
                  href="/ayarlar"
                  className="hidden md:flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-amber-400/90 hover:bg-zinc-800 transition-colors"
                  title="Ayarlar & Kontrol Merkezi"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Link>
              )}
              <Link
                href="/profil"
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-2 sm:px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                title="Profil & Hesabım"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-400 font-bold text-[11px]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline max-w-[80px] md:max-w-[100px] truncate">{user.name}</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border border-transparent hover:border-zinc-800"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Giriş Yap</span>
              </Link>
              <Link
                href="/register"
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
