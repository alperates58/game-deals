"use client";

import { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
  LogOut,
  LogIn,
  UserPlus,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { Role } from "@prisma/client";

interface SidebarProps {
  user: {
    userId: string;
    email: string;
    role: Role;
    name: string;
  } | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  authRequired?: boolean;
  isOwner?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ user, isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const navGroups: NavGroup[] = [
    {
      title: "GENEL",
      items: [
        { href: "/", label: "Ana Sayfa", icon: Sparkles },
        { href: "/firsatlar", label: "Tüm Fırsatlar", icon: TrendingDown },
        { href: "/tarihi-dip", label: "Tarihi Dip Fırsatları", icon: Clock },
        { href: "/eklentiler", label: "DLC & Eklentiler", icon: Layers },
      ],
    },
    {
      title: "KİŞİSEL",
      items: [
        { href: "/profil", label: "Profil & Dashboard", icon: User, authRequired: true },
        { href: "/kutuphane", label: "Kütüphanem", icon: Gamepad2, authRequired: true },
        { href: "/favoriler", label: "Favoriler", icon: Heart, authRequired: true },
        { href: "/istek-listem", label: "İstek Listesi", icon: Bookmark, authRequired: true },
        { href: "/alarmlar", label: "Fiyat Alarmları", icon: Bell, authRequired: true },
        { href: "/sana-ozel", label: "Sana Özel", icon: Sparkles, authRequired: true },
      ],
    },
    {
      title: "SİSTEM",
      items: [
        ...(user?.role === Role.OWNER
          ? [{ href: "/ayarlar", label: "Ayarlar & Kontrol", icon: Settings, isOwner: true }]
          : []),
      ],
    },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
      aria-label="Ana Gezinti"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-800 shrink-0">
        <Link href="/" className="flex items-center gap-3 overflow-hidden group">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-950/50 group-hover:bg-emerald-500 transition-colors">
            <Gamepad2 className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                Xbox Fırsat
              </span>
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">
                Türkiye
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6">
        {navGroups.map((group) => {
          if (group.items.length === 0) return null;

          return (
            <div key={group.title}>
              {!isCollapsed ? (
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group.title}
                </div>
              ) : (
                <div className="h-px bg-zinc-850 my-2 mx-2" />
              )}

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  // Target destination: if authRequired and not logged in, redirect to login
                  const targetHref = item.authRequired && !user ? `/login?redirect=${item.href}` : item.href;

                  return (
                    <Link
                      key={item.href}
                      href={targetHref}
                      title={isCollapsed ? item.label : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-600/15 text-emerald-400 font-semibold border border-emerald-500/20"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                      } ${isCollapsed ? "justify-center px-0 py-2.5" : ""}`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200"
                        }`}
                      />

                      {!isCollapsed && <span className="truncate">{item.label}</span>}

                      {/* Mini mode tooltip */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 hidden rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg border border-zinc-800 whitespace-nowrap group-hover:block z-50">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Footer / User Profile & Collapse Toggle */}
      <div className="border-t border-zinc-800 p-3 shrink-0 space-y-2">
        {user ? (
          <div
            className={`flex items-center gap-3 rounded-lg bg-zinc-900/60 p-2 border border-zinc-850 ${
              isCollapsed ? "justify-center p-2" : ""
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="rounded p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              title="Çıkış Yap"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <Link
              href="/login"
              className={`flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors ${
                isCollapsed ? "justify-center px-0" : ""
              }`}
              title={isCollapsed ? "Giriş Yap" : undefined}
            >
              <LogIn className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Giriş Yap</span>}
            </Link>

            {!isCollapsed && (
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-850 hover:text-white border border-zinc-800 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Kayıt Ol</span>
              </Link>
            )}
          </div>
        )}

        {/* Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
          title={isCollapsed ? "Sidebar'ı Genişlet" : "Sidebar'ı Daralt"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-[11px]">Daralt</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
