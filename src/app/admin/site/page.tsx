import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { getSystemSettings } from "@/lib/settings/system-settings";
import { Globe, Settings, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Site & Genel Ayarlar | Admin",
  description: "Genel site yapılandırması ve sistem parametreleri.",
};

export default async function AdminSitePage() {
  await requireOwner();
  const settings = await getSystemSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Globe className="h-4 w-4" />
            <span>Site</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Genel Site Yapılandırması</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Game Deals platformunun genel çalışma parametreleri ve kuralları.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="h-4 w-4 text-emerald-400" />
          <span>Platform Parametreleri</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Platform Başlığı:</span>
            <span className="font-semibold text-white">Game Deals (Dürüst Fırsat Takip)</span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Varsayılan Para Birimi:</span>
            <span className="font-mono text-zinc-300">TRY (Türk Lirası)</span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Varsayılan Dil:</span>
            <span className="font-mono text-zinc-300">tr-TR</span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Zaman Dilimi:</span>
            <span className="font-mono text-zinc-300">Europe/Istanbul (UTC+3)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
