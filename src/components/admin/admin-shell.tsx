"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  CreditCard,
  Key,
  Gamepad2,
  Layers,
  FileText,
  Star,
  Award,
  Video,
  Languages,
  Store,
  Sparkles,
  History,
  Bell,
  Clock,
  Activity,
  CheckCircle2,
  Sliders,
  Search,
  Database,
  ShieldAlert,
  AlertTriangle,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Send,
  TrendingDown,
} from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
  userEmail: string;
}

interface NavSection {
  title: string;
  items: {
    href: string;
    label: string;
    icon: any;
    exact?: boolean;
    badge?: string;
  }[];
}

const ADMIN_NAVIGATION: NavSection[] = [
  {
    title: "GENEL",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "YÖNETİM",
    items: [
      { href: "/admin/users", label: "Kullanıcılar", icon: Users },
      { href: "/admin/membership", label: "Üyelik & Erişim", icon: CreditCard },
      { href: "/admin/auth", label: "Kimlik Doğrulama", icon: Key },
    ],
  },
  {
    title: "KATALOG",
    items: [
      { href: "/admin/catalog", label: "Oyunlar & Overrides", icon: Gamepad2, exact: true },
      { href: "/admin/ratings", label: "Derecelendirmeler", icon: Star },
      { href: "/admin/subscriptions", label: "Abonelikler", icon: Award },
      { href: "/admin/languages", label: "Diller", icon: Languages },
      { href: "/admin/media", label: "Medya", icon: Video },
    ],
  },
  {
    title: "MAĞAZALAR",
    items: [
      { href: "/admin/integrations", label: "Entegrasyonlar", icon: Store },
    ],
  },
  {
    title: "FİYAT ZEKA",
    items: [
      { href: "/admin/deal-intelligence", label: "Deal Intelligence", icon: Sparkles },
      { href: "/admin/price-changes", label: "Fiyat Değişiklikleri", icon: TrendingDown },
    ],
  },
  {
    title: "OPERASYON",
    items: [
      { href: "/admin/operations/scheduler", label: "Scheduler & Jobs", icon: Clock },
      { href: "/admin/operations/sync-runs", label: "Sync Geçmişi", icon: History },
      { href: "/admin/operations/quality", label: "Data Quality", icon: CheckCircle2 },
      { href: "/admin/notifications", label: "Bildirim Merkezi", icon: Send },
      { href: "/admin/notifications/deliveries", label: "Gönderim Kuyruğu", icon: Activity },
    ],
  },
  {
    title: "SİTE",
    items: [
      { href: "/admin/homepage", label: "Anasayfa & Vitrin", icon: LayoutGrid },
      { href: "/admin/site", label: "Genel Ayarlar & Flags", icon: Sliders },
      { href: "/admin/seo", label: "SEO Yönetimi", icon: Search },
    ],
  },
  {
    title: "SİSTEM",
    items: [
      { href: "/admin/system/backup", label: "Backup & Restore", icon: Database },
      { href: "/admin/audit", label: "Audit Log", icon: ShieldAlert },
      { href: "/admin/system/health", label: "Sistem Sağlığı", icon: Activity },
      { href: "/admin/system/danger-zone", label: "Danger Zone", icon: AlertTriangle },
    ],
  },
];

export function AdminShell({ children, userEmail }: AdminShellProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-300">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-800 shrink-0">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-950">
            GD
          </div>
          <div>
            <span className="text-xs font-bold text-white tracking-wider uppercase block">CONTROL CENTER</span>
            <span className="text-[10px] text-emerald-400 font-mono">OWNER SYSTEM</span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 select-none scrollbar-thin scrollbar-thumb-zinc-800">
        {ADMIN_NAVIGATION.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-400" : "text-zinc-500"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 shrink-0">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-zinc-200 block truncate">{userEmail}</span>
            <span className="text-[10px] font-mono text-emerald-400">OWNER PRIVILEGE</span>
          </div>

          <Link
            href="/"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Siteye Dön"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-zinc-800 fixed inset-y-0 left-0 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold text-zinc-400 hidden sm:inline">
              Game Deals Admin Control Center
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/ayarlar"
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Kişisel Ayarlarım
            </Link>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <span>Siteyi Gör</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
