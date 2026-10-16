import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { CatalogTable } from "@/components/admin/catalog/catalog-table";
import { Gamepad2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Katalog Yönetimi & Oyunlar | Admin",
  description: "Tüm oyunlar, paketler ve DLC'ler, fiyat durumları ve manuel düzenleme.",
};

export default async function AdminCatalogPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Gamepad2 className="h-4 w-4" />
            <span>Katalog</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Katalog & Oyun Yönetimi</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Tüm oyun ve paketlerin mağaza durumları, fiyat geçmişleri, ilişkileri ve güvenli manuel ezmeleri.
          </p>
        </div>
      </div>

      <CatalogTable />
    </div>
  );
}
