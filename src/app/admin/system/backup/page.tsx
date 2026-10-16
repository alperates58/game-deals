import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { BackupClient } from "@/components/admin/system/backup-client";
import { Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Yedekleme & Geri Yükleme | Admin",
  description: "Veritabanı tam ve katalog yedekleri, doğrulama ve güvenli geri yükleme.",
};

export default async function AdminBackupPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Database className="h-4 w-4" />
            <span>Sistem</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Yedekleme & Geri Yükleme (Backup)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Sistem ve katalog verilerinin JSON yedeklerini alma, indirme ve geri yükleme.
          </p>
        </div>
      </div>

      <BackupClient />
    </div>
  );
}
