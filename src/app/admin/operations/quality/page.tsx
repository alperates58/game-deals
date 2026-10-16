import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { CatalogQualityPanel } from "@/components/settings/catalog-quality-panel";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Veri Kalitesi & Katalog Sağlığı | Admin",
  description: "Eksik afiş, fiyat anomalileri, yetim DLC ve yayınlanma hataları analizi.",
};

export default async function AdminQualityPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span>Operasyon</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Veri & Katalog Kalitesi (Data Quality)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Eksik fiyat, kırık afiş, yetim DLC/Addon ve sınıflandırma tutarsızlıklarının otomatik tespiti.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <CatalogQualityPanel />
      </div>
    </div>
  );
}
