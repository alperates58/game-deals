"use client";

import { useState, useEffect } from "react";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Layers,
  StopCircle,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";

interface SyncRun {
  id: string;
  trigger: string;
  status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  itemsProcessed: number;
  itemsAdded: number;
  itemsChanged: number;
  errorCount: number;
  count429: number;
  count5xx: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
}

export function SyncRunsClient() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspector modal
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runItems, setRunItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/sync-runs?limit=30");
      const data = await res.json();
      if (data.runs) {
        setRuns(data.runs);
      } else {
        setError(data.error || "Geçmiş yüklenemedi.");
      }
    } catch (err: any) {
      setError(err.message || "Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleCancelRun = async () => {
    if (!confirm("Çalışan senkronizasyon iptal edilsin mi?")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/settings/sync-runs/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İptal edilemedi.");
      await fetchRuns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleInspectRun = async (id: string) => {
    setSelectedRunId(id);
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/settings/sync-runs/${id}/items?limit=50`);
      const data = await res.json();
      setRunItems(data.items || []);
    } catch (err: any) {
      console.error(err);
      setRunItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const getStatusBadge = (status: SyncRun["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Tamamlandı
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Çalışıyor
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            Kısmi Başarılı
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/20">
            <XCircle className="h-3 w-3" />
            Başarısız
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400 border border-zinc-700">
            <StopCircle className="h-3 w-3" />
            İptal Edildi
          </span>
        );
    }
  };

  const hasRunning = runs.some((r) => r.status === "RUNNING");

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRuns}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>

        {hasRunning && (
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancelRun}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-950 border border-red-700/60 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/80 transition-colors"
          >
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
            <span>Çalışan Görevi İptal Et</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Runs Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Başlangıç</th>
              <th className="py-3 px-4">Tetikleyici</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4">İşlenen</th>
              <th className="py-3 px-4">Eklenen</th>
              <th className="py-3 px-4">Değişen</th>
              <th className="py-3 px-4">Hata</th>
              <th className="py-3 px-4">Süre</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Kayıtlar yükleniyor...
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-500">
                  Henüz senkronizasyon çalışması kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-200">
                    {new Date(r.startedAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      {r.trigger}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                  <td className="py-3 px-4 font-mono font-medium text-white">{r.itemsProcessed}</td>
                  <td className="py-3 px-4 font-mono text-emerald-400">+{r.itemsAdded}</td>
                  <td className="py-3 px-4 font-mono text-blue-400">{r.itemsChanged}</td>
                  <td className="py-3 px-4 font-mono">
                    {r.errorCount > 0 ? (
                      <span className="text-red-400 font-semibold">{r.errorCount}</span>
                    ) : (
                      <span className="text-zinc-500">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-400">
                    {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleInspectRun(r.id)}
                      className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors"
                    >
                      <span>İncele</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Drawer / Modal */}
      {selectedRunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Senkronizasyon Kalemleri</h3>
                <p className="text-[11px] font-mono text-zinc-400">ID: {selectedRunId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRunId(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingItems ? (
                <div className="py-12 text-center text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Kalemler yükleniyor...
                </div>
              ) : runItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Bu çalıştırmaya ait detaylı ürün kalemi kaydı yok veya tümü toplu işlendi.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {runItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80 text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate">{item.title || item.productId}</p>
                        <p className="text-[10px] font-mono text-zinc-400">{item.productId}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs text-zinc-300">{item.action}</span>
                        {item.error && <p className="text-[10px] text-red-400">{item.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 text-right">
              <button
                type="button"
                onClick={() => setSelectedRunId(null)}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
