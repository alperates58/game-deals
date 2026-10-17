import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PriceChangesClient } from "@/components/admin/price-changes/price-changes-client";
import { TrendingDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Fiyat Değişiklikleri & Radar | Admin",
  description: "Tüm katalogdaki fiyat hareketleri, indirimler, zamlar ve tarihi dip değişim kayıtları.",
};

export default async function AdminPriceChangesPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <TrendingDown className="h-4 w-4" />
            <span>Fiyat Zeka</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Fiyat Değişiklikleri & Radar</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Tüm katalog genelinde tespit edilen fiyat hareketleri, indirimler, zamlar ve tarihi dip kayıtları.
          </p>
        </div>
      </div>

      <PriceChangesClient />
    </div>
  );
}
