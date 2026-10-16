import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { NotificationDeliveriesClient } from "@/components/admin/notifications/notification-deliveries-client";
import { Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Bildirim Teslimat Kuyruğu | Admin",
  description: "E-posta, Telegram ve In-App bildirim teslimat durumları, hatalar ve yeniden deneme.",
};

export default async function AdminDeliveriesPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Bell className="h-4 w-4" />
            <span>Operasyon</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bildirim Teslimat Kuyruğu (Deliveries)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Tüm kanallardaki bildirim paketlerinin iletim durumları, yeniden deneme sayıları ve hata kayıtları.
          </p>
        </div>
      </div>

      <NotificationDeliveriesClient />
    </div>
  );
}
