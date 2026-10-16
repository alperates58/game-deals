import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { AuditLogClient } from "@/components/admin/audit/audit-log-client";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Yönetici Denetim Günlüğü (Audit Log) | Admin",
  description: "Tüm idari eylemler, kullanıcı statü değişiklikleri ve manuel ezme kayıtları.",
};

export default async function AdminAuditPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Sistem</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Yönetici Denetim Günlüğü (AdminAuditLog)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Sistem yöneticileri tarafından yapılan tüm yetki, üyelik, katalog ve bildirim değişikliklerinin değişmez kayıtları.
          </p>
        </div>
      </div>

      <AuditLogClient />
    </div>
  );
}
