import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { getSystemSettings } from "@/lib/settings/system-settings";
import { SchedulerClient } from "@/components/admin/operations/scheduler-client";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Scheduler & Zamanlanmış Görevler | Admin",
  description: "Arka plan işçi döngüsü, senkronizasyon aralıkları ve görev geçmişi.",
};

export default async function AdminSchedulerPage() {
  await requireOwner();
  const settings = await getSystemSettings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Calendar className="h-4 w-4" />
            <span>Operasyon</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Scheduler & Zamanlayıcı Yönetimi</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Fiyat senkronizasyonu, katalog keşfi, metadata yenileme periyotları ve anlık tetiklemeler.
          </p>
        </div>
      </div>

      <SchedulerClient
        initialSettings={{
          autoDiscoverSeriesCatalog: settings.autoDiscoverSeriesCatalog,
          catalogDiscoveryIntervalHours: settings.catalogDiscoveryIntervalHours,
          priceSyncIntervalHours: settings.priceSyncIntervalHours,
          metadataRefreshIntervalHours: settings.metadataRefreshIntervalHours,
          relationshipRefreshIntervalHours: settings.relationshipRefreshIntervalHours,
          autoDiscoverBundleChildren: settings.autoDiscoverBundleChildren,
          autoDiscoverRelatedDlc: settings.autoDiscoverRelatedDlc,
          autoAddRelatedProducts: settings.autoAddRelatedProducts,
        }}
      />
    </div>
  );
}
