import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSystemSettings, calculateScheduleInfo } from "@/lib/settings/system-settings";
import { BackupService } from "@/lib/backup/backup-service";
import { SettingsCenter } from "@/components/settings/settings-center";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Role } from "@prisma/client";

export const metadata: Metadata = {
  title: "Ayarlar ve Kontrol Merkezi | game.alperates.com.tr",
  description: "Sistem yöneticisi kontrol ve konfigürasyon paneli.",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/ayarlar");
  }

  if (user.role !== Role.OWNER) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-950/60 border border-red-800 text-red-400 mb-6">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">Erişim Engellendi (403)</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Ayarlar ve kontrol merkezi yalnızca sistem yöneticisi (<span className="text-emerald-400 font-mono">OWNER</span>)
          rolüne sahip hesaplar tarafından görüntülenebilir ve değiştirilebilir. Mevcut hesabınız (
          <span className="text-zinc-200">{user.email}</span>) standart kullanıcı rolündedir.
        </p>
        <Link
          href="/profil"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Profile Geri Dön
        </Link>
      </div>
    );
  }

  const [
    settings,
    totalGames,
    totalHistories,
    totalDeals,
    totalRelations,
    totalUsers,
    totalAlerts,
    totalPendingNotifications,
    lastSyncRun,
    relationsByType,
    gamesByType,
    initialBackups,
  ] = await Promise.all([
    getSystemSettings(),
    prisma.game.count(),
    prisma.priceHistory.count(),
    prisma.dealAnalysis.count(),
    prisma.gameRelation.count(),
    prisma.user.count(),
    prisma.priceAlert.count({ where: { isEnabled: true } }),
    prisma.notificationEvent.count({ where: { status: "PENDING" } }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.gameRelation.groupBy({
      by: ["relationType"],
      _count: { relationType: true },
    }),
    prisma.game.groupBy({
      by: ["productType"],
      _count: { productType: true },
    }),
    BackupService.listBackups(),
  ]);

  const scheduleInfo = calculateScheduleInfo({
    autoDiscoverSeriesCatalog: settings.autoDiscoverSeriesCatalog,
    catalogDiscoveryIntervalHours: settings.catalogDiscoveryIntervalHours,
    priceSyncIntervalHours: settings.priceSyncIntervalHours,
    metadataRefreshIntervalHours: settings.metadataRefreshIntervalHours,
    relationshipRefreshIntervalHours: settings.relationshipRefreshIntervalHours,
    lastCatalogDiscoveryAt: settings.lastCatalogDiscoveryAt,
    lastPriceSyncAt: settings.lastPriceSyncAt,
  });

  const initialStats = {
    totalGames,
    totalHistories,
    totalDeals,
    totalRelations,
    totalUsers,
    activeAlerts: totalAlerts,
    pendingNotifications: totalPendingNotifications,
    lastSyncRun: lastSyncRun
      ? {
          status: lastSyncRun.status,
          startedAt: lastSyncRun.startedAt.toISOString(),
          finishedAt: lastSyncRun.finishedAt ? lastSyncRun.finishedAt.toISOString() : null,
          productsChecked: lastSyncRun.productsChecked,
          pricesChanged: lastSyncRun.pricesChanged,
          errorCount: lastSyncRun.errorCount,
        }
      : null,
    relationsByType: relationsByType.map((r: any) => ({ type: r.relationType, count: r._count.relationType })),
    gamesByType: gamesByType.map((g: any) => ({ type: g.productType, count: g._count.productType })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <ShieldAlert className="h-4 w-4" />
            <span>Sistem Yöneticisi Paneli</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Ayarlar ve Kontrol Merkezi</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Katalog takibi, otomatik keşif kuralları, senkronizasyon zamanlaması, veritabanı yedeği ve telemetrisi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-emerald-950/80 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-800/60">
            Rol: OWNER ({user.email})
          </span>
        </div>
      </div>

      <SettingsCenter
        initialSettings={settings}
        initialStats={initialStats}
        initialScheduleInfo={scheduleInfo}
        initialBackups={initialBackups as any}
      />
    </div>
  );
}
