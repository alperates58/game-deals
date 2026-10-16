import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { SyncRunsClient } from "@/components/admin/operations/sync-runs-client";
import { RotateCcw } from "lucide-react";

export const metadata: Metadata = {
  title: "Senkronizasyon Geçmişi & Çalışmalar | Admin",
  description: "Xbox ve katalog senkronizasyon geçmişi, kalem analizleri ve hata günlükleri.",
};

export default async function AdminSyncRunsPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <RotateCcw className="h-4 w-4" />
            <span>Operasyon</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Senkronizasyon Geçmişi (Sync Runs)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Tüm otomatik ve manuel senkronizasyon çalıştırmaları, kalem değişimleri ve hata kayıtları.
          </p>
        </div>
      </div>

      <SyncRunsClient />
    </div>
  );
}
