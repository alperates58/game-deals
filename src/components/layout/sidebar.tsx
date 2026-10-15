"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gamepad2,
  Sparkles,
  TrendingDown,
  Clock,
  Layers,
  User,
  Heart,
  Bookmark,
  Bell,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Role } from "@prisma/client";
import { LiveSearch } from "./live-search";
import { BrandLogo } from "./brand-logo";

export interface SidebarProps {
  user: {
    userId: string;
    email: string;
    role: Role;
    name: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  authRequired?: boolean;
  isOwner?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);

  // Mount check for React Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth open / close animation lifecycle
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Wait for next frame so the transition animates in
      const frame = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on route navigation
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [pathname]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while sidebar is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onClose();
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  // Swipe-to-close handler on drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchCurrentX.current !== null) {
      const diff = touchCurrentX.current - touchStartX.current;
      // If user swiped left by 45px or more, close the sidebar
      if (diff < -45) {
        onClose();
      }
    }
    touchStartX.current = null;
    touchCurrentX.current = null;
  };

  const navGroups: NavGroup[] = [
    {
      title: "FIRSATLAR & KATALOG",
      items: [
        { href: "/", label: "Ana Sayfa", icon: Sparkles },
        { href: "/firsatlar", label: "Tüm Fırsatlar", icon: TrendingDown },
        {
          href: "/tarihi-dip",
          label: "Tarihi Dip Fırsatları",
          icon: Clock,
          badge: "Dip",
          badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        },
        {
          href: "/eklentiler",
          label: "DLC & Eklentiler",
          icon: Layers,
          badge: "DLC",
          badgeColor: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
        },
      ],
    },
    {
      title: "KİŞİSEL ALAN",
      items: [
        { href: "/profil", label: "Profil & Dashboard", icon: User, authRequired: true },
        { href: "/kutuphane", label: "Kütüphanem", icon: Gamepad2, authRequired: true },
        { href: "/favoriler", label: "Favorilerim", icon: Heart, authRequired: true },
        { href: "/istek-listem", label: "İstek Listesi", icon: Bookmark, authRequired: true },
        { href: "/alarmlar", label: "Fiyat Alarmları", icon: Bell, authRequired: true },
        { href: "/sana-ozel", label: "Sana Özel", icon: Sparkles, authRequired: true },
      ],
    },
    ...(user?.role === Role.OWNER
      ? [
          {
            title: "SİSTEM YÖNETİMİ",
            items: [
              {
                href: "/ayarlar",
                label: "Ayarlar & Kontrol Merkezi",
                icon: Settings,
                badge: "Yönetici",
                badgeColor: "bg-red-500/20 text-red-300 border border-red-500/30",
                isOwner: true,
              },
            ],
          },
        ]
      : []),
  ];

  if (!mounted || !isRendered) {
    return null;
  }

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Dark Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Sliding Drawer Panel - Completely Solid Background (No transparency) */}
      <aside
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-y-0 left-0 w-[310px] max-w-[85vw] h-full h-[100dvh] flex flex-col bg-[#09090b] border-r border-zinc-800 shadow-2xl transform transition-transform duration-300 ease-out select-none z-[10000] ${
          isAnimating ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobil Menü"
      >
        {/* Header / Brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-800 bg-[#09090b] shrink-0">
          <BrandLogo onClick={onClose} showTagline={true} size="md" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Menüyü Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Search inside Sidebar */}
        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/30 shrink-0 relative z-30">
          <LiveSearch
            onItemSelect={onClose}
            placeholder="Oyun veya DLC ara..."
            className="relative w-full"
            dropdownAlign="full"
          />
        </div>

        {/* Navigation Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-4 px-3 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {group.title}
              </div>

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  const targetHref =
                    item.authRequired && !user
                      ? `/login?redirect=${encodeURIComponent(item.href)}`
                      : item.href;

                  return (
                    <Link
                      key={item.href}
                      href={targetHref}
                      onClick={onClose}
                      className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30 shadow-sm"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-emerald-400"
                              : "text-zinc-400 group-hover:text-emerald-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                            item.badgeColor || "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-600 opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Account / User Footer Card */}
        <div className="border-t border-zinc-800 bg-[#09090b] p-3.5 shrink-0 space-y-2 mt-auto">
          {user ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900/90 p-3 border border-zinc-800">
              <Link
                href="/profil"
                onClick={onClose}
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors shrink-0"
                title="Çıkış Yap"
                aria-label="Çıkış Yap"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition-colors text-center"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Giriş Yap</span>
              </Link>

              <Link
                href="/register"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors text-center"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Kayıt Ol</span>
              </Link>
            </div>
          )}

          <div className="pt-1 text-center">
            <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              <span>Dürüst Fırsat Takip • game.alperates.com.tr</span>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
