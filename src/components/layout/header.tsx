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
  ShieldCheck,
  Package,
} from "lucide-react";
import { LiveSearch } from "./live-search";
import { BrandLogo } from "./brand-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import { MobileNav } from "./mobile-nav";
import { prisma } from "@/lib/db/prisma";

export async function Header() {
  const user = await getCurrentUser();
  const unreadNotificationsCount = user
    ? await prisma.userNotification.count({
        where: { userId: user.userId, readAt: null },
      })
    : 0;


  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/90 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 gap-2 sm:gap-4">
        {/* Left: Hamburger (Mobile) + Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <MobileNav user={user} />

          <BrandLogo />

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 ml-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ana Sayfa</span>
            </Link>
            <Link
              href="/firsatlar"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
            >
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Fırsatlar</span>
            </Link>
            <Link
              href="/tarihi-dip"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
            >
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              <span>Tarihi Dip</span>
            </Link>
            <Link
              href="/firsatlar?type=bundle"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
            >
              <Package className="h-3.5 w-3.5 text-purple-400" />
              <span>Paketler</span>
            </Link>
            <Link
              href="/eklentiler"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
            >
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <span>DLC & Eklentiler</span>
            </Link>
          </nav>
        </div>

        {/* Center / Right: Live Search */}
        <div className="flex flex-1 justify-end items-center px-1 sm:px-3 min-w-[150px] sm:min-w-[180px] md:min-w-[200px] max-w-xs md:max-w-sm lg:max-w-md">
          <LiveSearch className="w-full" dropdownAlign="right" />
        </div>

        {/* Right: User / Auth Navigation */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link
                href="/bildirimler"
                className="relative flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
                title="Bildirim Kutusu"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </Link>
              <Link
                href="/kutuphane"
                className="hidden sm:flex items-center gap-1.5 rounded-lg p-2 2xl:px-2.5 2xl:py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
                title="Kütüphanem"
              >
                <Gamepad2 className="h-4 w-4 text-emerald-400" />
                <span className="hidden 2xl:inline">Kütüphanem</span>
              </Link>
              <Link
                href="/ayarlar"
                className="hidden md:flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
                title="Kişisel Ayarlar"
              >
                <Settings className="h-4 w-4" />
              </Link>
              {user.role === Role.OWNER && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-lg p-2 2xl:px-2.5 2xl:py-1.5 text-xs font-semibold text-red-400 bg-red-950/40 border border-red-800/40 hover:bg-red-900/60 transition-colors shrink-0"
                  title="Admin Kontrol Merkezi"
                >
                  <ShieldCheck className="h-4 w-4 text-red-400" />
                  <span className="hidden 2xl:inline">Admin</span>
                </Link>
              )}
              <Link
                href="/profil"
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 2xl:px-2.5 2xl:py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 transition-all shrink-0"
                title={`Profil: ${user.name}`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-400 font-bold text-[11px] shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden 2xl:inline max-w-[90px] truncate">{user.name}</span>
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
