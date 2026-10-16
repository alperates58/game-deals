"use client";

import { useState } from "react";
import { AlertOctagon, RotateCcw, Trash2, Zap, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function AdminDangerZonePage() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleClearLock = async () => {
    if (!confirm("Senkronizasyon kilidini (sync-runs cancel) zorla kaldırmak istediğinize emin misiniz?")) return;
    setLoadingAction("lock");
    setResult(null);
    try {
      const res = await fetch("/api/settings/sync-runs/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kilit kaldırılamadı");
      setResult({ text: "Senkronizasyon kilidi başarıyla kaldırıldı.", type: "success" });
    } catch (err: any) {
      setResult({ text: err.message || "Hata", type: "error" });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">
            <AlertOctagon className="h-4 w-4" />
            <span>Sistem</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tehlikeli Bölge (Danger Zone)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Sistem kilitlerini temizleme, acil durum sıfırlamaları ve yüksek riskli işlemler.
          </p>
        </div>
      </div>

      {result && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center gap-2 border ${
            result.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{result.text}</span>
        </div>
      )}

      <div className="rounded-xl border border-red-900/60 bg-red-950/10 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-900/30 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Senkronizasyon Kilidini Kaldır (Clear Sync Lock)</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Takılı kalan veya beklenmedik şekilde kesintiye uğrayan senkronizasyon çalıştırmalarının kilidini sıfırlar.
            </p>
          </div>

          <button
            type="button"
            disabled={loadingAction === "lock"}
            onClick={handleClearLock}
            className="inline-flex items-center gap-2 rounded-lg bg-red-900 hover:bg-red-800 px-4 py-2 text-xs font-semibold text-red-100 transition-colors disabled:opacity-50 shrink-0"
          >
            {loadingAction === "lock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            <span>Kilidi Kaldır</span>
          </button>
        </div>
      </div>
    </div>
  );
}
