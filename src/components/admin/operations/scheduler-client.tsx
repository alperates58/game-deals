"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Settings2,
  Zap,
} from "lucide-react";
import { ScheduledJobsTable } from "@/components/settings/scheduled-jobs-table";

interface SchedulerClientProps {
  initialSettings: {
    autoDiscoverSeriesCatalog: boolean;
    catalogDiscoveryIntervalHours: number;
    priceSyncIntervalHours: number;
    metadataRefreshIntervalHours: number;
    relationshipRefreshIntervalHours: number;
    autoDiscoverBundleChildren: boolean;
    autoDiscoverRelatedDlc: boolean;
    autoAddRelatedProducts: boolean;
  };
}

export function SchedulerClient({ initialSettings }: SchedulerClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSaveIntervals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Ayar kaydedilemedi.");
      setMessage({ text: "Zamanlayıcı ayarları başarıyla kaydedildi.", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Bir hata oluştu", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    if (!confirm("Tüm katalog ve fiyat senkronizasyonunu HEMEN başlatmak istediğinize emin misiniz?")) {
      return;
    }
    setSyncingNow(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/sync-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Senkronizasyon başlatılamadı");
      setMessage({ text: "Senkronizasyon arka planda başlatıldı!", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Başlatma hatası", type: "error" });
    } finally {
      setSyncingNow(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center gap-2 border ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            Anlık Manuel Senkronizasyon
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Zamanlanmış aralıkları beklemeden tüm kuyruğu tetikler.
          </p>
        </div>

        <button
          type="button"
          disabled={syncingNow}
          onClick={handleSyncNow}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
        >
          {syncingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          <span>{syncingNow ? "Tetikleniyor..." : "Şimdi Senkronize Et"}</span>
        </button>
      </div>

      {/* Interval Settings Form */}
      <form onSubmit={handleSaveIntervals} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-zinc-800 pb-3">
          <Settings2 className="h-4 w-4 text-emerald-400" />
          <span>Zamanlayıcı Aralıkları ve Keşif Politikaları</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Fiyat Senkronizasyonu (Saat)
            </label>
            <input
              type="number"
              min={1}
              max={72}
              value={settings.priceSyncIntervalHours}
              onChange={(e) =>
                setSettings({ ...settings, priceSyncIntervalHours: parseInt(e.target.value) || 6 })
              }
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Önerilen: 6 saat</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Katalog Keşfi (Saat)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={settings.catalogDiscoveryIntervalHours}
              onChange={(e) =>
                setSettings({ ...settings, catalogDiscoveryIntervalHours: parseInt(e.target.value) || 24 })
              }
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Önerilen: 24 saat</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Metadata Tazeleme (Saat)
            </label>
            <input
              type="number"
              min={24}
              max={720}
              value={settings.metadataRefreshIntervalHours}
              onChange={(e) =>
                setSettings({ ...settings, metadataRefreshIntervalHours: parseInt(e.target.value) || 168 })
              }
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Önerilen: 168 saat (7 gün)</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              İlişki Tazeleme (Saat)
            </label>
            <input
              type="number"
              min={24}
              max={720}
              value={settings.relationshipRefreshIntervalHours}
              onChange={(e) =>
                setSettings({ ...settings, relationshipRefreshIntervalHours: parseInt(e.target.value) || 168 })
              }
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Önerilen: 168 saat (7 gün)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-800/80">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autoDiscoverSeriesCatalog}
              onChange={(e) => setSettings({ ...settings, autoDiscoverSeriesCatalog: e.target.checked })}
              className="rounded bg-zinc-950 border-zinc-700 text-emerald-600 focus:ring-0"
            />
            <span>Xbox Series Otomatik Keşif</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autoDiscoverBundleChildren}
              onChange={(e) => setSettings({ ...settings, autoDiscoverBundleChildren: e.target.checked })}
              className="rounded bg-zinc-950 border-zinc-700 text-emerald-600 focus:ring-0"
            />
            <span>Bundle İçeriklerini Otomatik Keşfet</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autoDiscoverRelatedDlc}
              onChange={(e) => setSettings({ ...settings, autoDiscoverRelatedDlc: e.target.checked })}
              className="rounded bg-zinc-950 border-zinc-700 text-emerald-600 focus:ring-0"
            />
            <span>DLC / Eklentileri Otomatik Keşfet</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            <span>{saving ? "Kaydediliyor..." : "Aralıkları Kaydet"}</span>
          </button>
        </div>
      </form>

      {/* Embedded Scheduled Jobs Live Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-400" />
          <span>Görev Durumları ve Canlı İstatistikler</span>
        </h2>
        <ScheduledJobsTable />
      </div>
    </div>
  );
}
