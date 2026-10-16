"use client";

import Link from "next/link";
import {
  Users,
  Gamepad2,
  TrendingDown,
  Bell,
  Database,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Layers,
  History,
  Send,
  Zap,
} from "lucide-react";

interface AdminDashboardProps {
  stats: {
    totalUsers: number;
    active24hUsers: number;
    totalGames: number;
    baseGamesCount: number;
    bundleGamesCount: number;
    dlcGamesCount: number;
    totalPriceHistories: number;
    activeAlerts: number;
    pendingNotifications: number;
    priceChanges24h: number;
    catalogHealthScore: number;
    catalogGrade: string;
  };
  systemHealth: {
    postgres: { status: string; evidence: string; lastChecked: string };
    worker: { status: string; evidence: string; lastChecked: string };
    scheduler: { status: string; evidence: string; lastChecked: string };
    xboxCollector: { status: string; evidence: string; lastChecked: string };
    googleOAuth: { status: string; evidence: string; lastChecked: string };
    emailSmtp: { status: string; evidence: string; lastChecked: string };
    telegramBot: { status: string; evidence: string; lastChecked: string };
    backup: { status: string; evidence: string; lastChecked: string };
  };
  lastSync: {
    type: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    productsChecked: number;
    pricesChanged: number;
    errorCount: number;
  } | null;
  recentAuditLogs: {
    id: string;
    action: string;
    entityType: string;
    actorEmail: string | null;
    createdAt: string;
    reason: string | null;
  }[];
}

export function AdminDashboard({ stats, systemHealth, lastSync, recentAuditLogs }: AdminDashboardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            HEALTHY
          </span>
        );
      case "DEGRADED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/80 border border-amber-800/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            DEGRADED
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-950/80 border border-rose-800/80 px-2.5 py-0.5 text-[11px] font-bold text-rose-400">
            <XCircle className="h-3 w-3" />
            FAILED
          </span>
        );
      case "NOT_CONFIGURED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/80 px-2.5 py-0.5 text-[11px] font-bold text-zinc-400">
            <HelpCircle className="h-3 w-3" />
            NOT_CONFIGURED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/80 px-2.5 py-0.5 text-[11px] font-bold text-zinc-400">
            UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">System Control Center</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Katalog operasyonları, gerçek veritabanı telemetrisi, kullanıcı yönetimi ve sistem sağlığı.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/operations/scheduler"
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Operasyon Kontrolleri</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Users */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Kullanıcılar</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalUsers}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Son 24h: {stats.active24hUsers} aktif</div>
        </div>

        {/* Total Games */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Katalog</span>
            <Gamepad2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalGames}</div>
          <div className="text-[10px] text-zinc-500 mt-1">{stats.baseGamesCount} ana oyun</div>
        </div>

        {/* DLC & Bundles */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">DLC & Bundle</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats.dlcGamesCount + stats.bundleGamesCount}</div>
          <div className="text-[10px] text-zinc-500 mt-1">{stats.bundleGamesCount} paket, {stats.dlcGamesCount} dlc</div>
        </div>

        {/* Price History */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fiyat Kaydı</span>
            <TrendingDown className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalPriceHistories}</div>
          <div className="text-[10px] text-zinc-500 mt-1">24h değişim: {stats.priceChanges24h}</div>
        </div>

        {/* Active Alerts */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Aktif Alarmlar</span>
            <Bell className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats.activeAlerts}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Bekleyen event: {stats.pendingNotifications}</div>
        </div>

        {/* Catalog Health */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Katalog Sağlığı</span>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400">%{stats.catalogHealthScore}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Derece: {stats.catalogGrade}</div>
        </div>
      </div>

      {/* SYSTEM HEALTH GRID (Truthful UI) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Gerçek Sistem Sağlığı ve Servis Durumları</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tüm servis durumları gerçek çalışma kanıtlarına ve ortam değişkenlerine dayanır. Sahte telemetri üretilmez.
            </p>
          </div>

          <Link
            href="/admin/system/health"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Detaylı Telemetri</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Object.entries(systemHealth).map(([serviceKey, data]) => {
            const labels: Record<string, string> = {
              postgres: "PostgreSQL Veritabanı",
              worker: "Autonomous Worker",
              scheduler: "Scheduler Motoru",
              xboxCollector: "Xbox Collector",
              googleOAuth: "Google OAuth 2.0",
              emailSmtp: "E-posta (SMTP)",
              telegramBot: "Telegram Bot API",
              backup: "Veritabanı Yedeği",
            };

            return (
              <div key={serviceKey} className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-200 truncate">{labels[serviceKey] || serviceKey}</span>
                  {getStatusBadge(data.status)}
                </div>

                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed font-mono">
                  {data.evidence}
                </p>

                <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                  Kontrol: {data.lastChecked}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-Column Activity Overview: Last Sync Run & Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Sync Overview */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-400" />
              <span>Son Senkronizasyon Durumu</span>
            </h3>
            <Link
              href="/admin/operations/sync-runs"
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <span>Geçmiş</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {lastSync ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Görev Türü:</span>
                <span className="text-xs font-mono font-bold text-zinc-200">{lastSync.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Durum:</span>
                <span className="text-xs font-bold text-emerald-400">{lastSync.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Taranan Ürün:</span>
                <span className="text-xs font-bold text-zinc-200">{lastSync.productsChecked}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Fiyat Değişimi:</span>
                <span className="text-xs font-bold text-amber-400">{lastSync.pricesChanged}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Hata Sayısı:</span>
                <span className={`text-xs font-bold ${lastSync.errorCount > 0 ? "text-rose-400" : "text-zinc-500"}`}>
                  {lastSync.errorCount}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
                Başlangıç: {new Date(lastSync.startedAt).toLocaleString("tr-TR")}
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 py-6 text-center">Henüz senkronizasyon kaydı bulunamadı.</div>
          )}
        </div>

        {/* Recent Admin Audit Logs */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Son Yönetici İşlemleri (Audit Log)</span>
            </h3>
            <Link
              href="/admin/audit"
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <span>Tümü</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentAuditLogs.length > 0 ? (
            <div className="divide-y divide-zinc-800/60">
              {recentAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-zinc-200 block truncate">{log.action}</span>
                    <span className="text-[11px] text-zinc-500">
                      {log.actorEmail || "Sistem"} • {new Date(log.createdAt).toLocaleTimeString("tr-TR")}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 shrink-0">
                    {log.entityType}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-500 py-6 text-center">Henüz yönetici işlem kaydı bulunmuyor.</div>
          )}
        </div>
      </div>
    </div>
  );
}
