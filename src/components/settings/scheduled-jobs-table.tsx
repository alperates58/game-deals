"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Power,
  RotateCcw,
  Zap,
} from "lucide-react";

export interface ScheduledJobInfo {
  jobType: "PRICE_SYNC" | "CATALOG_DISCOVERY" | "METADATA_REFRESH" | "RELATIONSHIP_REFRESH";
  enabled: boolean;
  intervalHours: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  durationMs: number | null;
  itemsProcessed: number;
  itemsAdded: number;
  itemsChanged: number;
  errorCount: number;
  count429: number;
  count5xx: number;
  errorSummary: string | null;
}

const JOB_METADATA: Record<
  ScheduledJobInfo["jobType"],
  { title: string; subtitle: string; icon: any; defaultInterval: string }
> = {
  PRICE_SYNC: {
    title: "Fiyat Senkronizasyonu",
    subtitle: "Aktif oyunların fiyat ve indirim sorgusu",
    icon: RefreshCw,
    defaultInterval: "6 saat",
  },
  CATALOG_DISCOVERY: {
    title: "Katalog Keşfi",
    subtitle: "Microsoft Mağazasından yeni oyun/paket taraması",
    icon: Zap,
    defaultInterval: "24 saat",
  },
  METADATA_REFRESH: {
    title: "Metadata Tazeleme",
    subtitle: "Afiş, açıklama, yapımcı ve tür bilgileri",
    icon: Clock,
    defaultInterval: "7 gün (168h)",
  },
  RELATIONSHIP_REFRESH: {
    title: "İlişki Doğrulama",
    subtitle: "Paket içerikleri ve yetim DLC/Add-on eşleme",
    icon: RotateCcw,
    defaultInterval: "7 gün (168h)",
  },
};

export function ScheduledJobsTable() {
  const [jobs, setJobs] = useState<ScheduledJobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/settings/scheduled-jobs");
      const data = await res.json();
      if (data.success && data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err: any) {
      console.error("[ScheduledJobsTable] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll every 15s to catch status updates from worker
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleEnable = async (jobType: ScheduledJobInfo["jobType"], currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/settings/scheduled-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType, enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setJobs((prev) =>
          prev.map((j) => (j.jobType === jobType ? { ...j, enabled: !currentEnabled } : j))
        );
        setActionMessage({
          text: `${JOB_METADATA[jobType].title} ${!currentEnabled ? "etkinleştirildi" : "devre dışı bırakıldı"}.`,
          type: "success",
        });
      }
    } catch (err: any) {
      setActionMessage({ text: "Durum güncellenemedi.", type: "error" });
    }
  };

  const handleRunNow = async (jobType: ScheduledJobInfo["jobType"]) => {
    setRunningJob(jobType);
    setActionMessage(null);
    try {
      const res = await fetch("/api/settings/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: jobType }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          text: `İşlem tamamlandı: ${data.message}`,
          type: "success",
        });
        await fetchJobs();
      } else {
        setActionMessage({
          text: data.error || data.message || "İşlem yürütülemedi.",
          type: "error",
        });
      }
    } catch (err: any) {
      setActionMessage({ text: `Hata: ${err.message}`, type: "error" });
    } finally {
      setRunningJob(null);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: ScheduledJobInfo["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
            <CheckCircle2 className="h-3 w-3" />
            COMPLETED
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-400 border border-amber-800/80">
            <AlertTriangle className="h-3 w-3" />
            PARTIAL
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-950/80 text-red-400 border border-red-800/80">
            <XCircle className="h-3 w-3" />
            FAILED
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-950/80 text-blue-400 border border-blue-800/80 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            RUNNING
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-500 border border-zinc-800">
            IDLE
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span>Otonom Zamanlanmış İşler & Telemetri (Worker Durumu)</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Ayrık arka plan worker süreci tarafından yürütülen 4 bağımsız periyodik işin canlı durumu.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchJobs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Yenile</span>
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            actionMessage.type === "success"
              ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
              : "bg-red-950/40 text-red-300 border-red-800/60"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800/90">
        <table className="w-full text-left text-xs text-zinc-300 min-w-[850px]">
          <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="py-2.5 px-3 font-semibold">İş (Job)</th>
              <th className="py-2.5 px-2 font-semibold text-center">Durum</th>
              <th className="py-2.5 px-2 font-semibold text-center">Aktif</th>
              <th className="py-2.5 px-3 font-semibold">Son Başarılı</th>
              <th className="py-2.5 px-3 font-semibold">Sonraki Koşu</th>
              <th className="py-2.5 px-2 font-semibold text-right">Süre</th>
              <th className="py-2.5 px-2 font-semibold text-right">İşlenen</th>
              <th className="py-2.5 px-2 font-semibold text-right">Eklenen/Değişen</th>
              <th className="py-2.5 px-2 font-semibold text-center">Hata/429</th>
              <th className="py-2.5 px-3 font-semibold text-right">Eylem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
            {jobs.map((job) => {
              const meta = JOB_METADATA[job.jobType];
              const Icon = meta?.icon || Clock;
              const isRunning = runningJob === job.jobType || job.status === "RUNNING";

              return (
                <tr key={job.jobType} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-3 font-sans">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-zinc-800 text-emerald-400 shrink-0">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-xs">{meta?.title || job.jobType}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {job.jobType} ({job.intervalHours}h)
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-2 text-center font-sans">
                    {getStatusBadge(job.status)}
                  </td>

                  <td className="py-3 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleEnable(job.jobType, job.enabled)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold transition-colors ${
                        job.enabled
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900"
                          : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <Power className="h-2.5 w-2.5" />
                      {job.enabled ? "Açık" : "Kapalı"}
                    </button>
                  </td>

                  <td className="py-3 px-3 text-zinc-300">
                    {formatDate(job.lastSuccessAt || job.lastFinishedAt)}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-300">{formatDate(job.nextRunAt)}</span>
                      {job.nextRunAt && new Date(job.nextRunAt).getTime() <= Date.now() && job.enabled && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-sans">
                          Vadesi Geldi
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-2 text-right text-zinc-400">
                    {job.durationMs != null ? `${Math.round(job.durationMs / 1000)}s` : "-"}
                  </td>

                  <td className="py-3 px-2 text-right text-zinc-200">
                    {job.itemsProcessed.toLocaleString("tr-TR")}
                  </td>

                  <td className="py-3 px-2 text-right">
                    <span className="text-emerald-400">+{job.itemsAdded}</span>
                    <span className="text-zinc-500 mx-1">/</span>
                    <span className="text-cyan-400">~{job.itemsChanged}</span>
                  </td>

                  <td className="py-3 px-2 text-center">
                    <span className={job.errorCount > 0 ? "text-red-400 font-bold" : "text-zinc-500"}>
                      {job.errorCount}
                    </span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className={job.count429 > 0 ? "text-amber-400 font-bold" : "text-zinc-500"}>
                      {job.count429}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-sans">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleRunNow(job.jobType)}
                      className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-800/80 border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-200 disabled:opacity-50 transition-all"
                      title="Bu işi PostgreSQL advisory lock korumalı hemen yürüt"
                    >
                      {isRunning ? (
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                      ) : (
                        <Play className="h-3 w-3 text-emerald-400 fill-current" />
                      )}
                      <span>{isRunning ? "Çalışıyor..." : "Çalıştır"}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
        <span>* Kilit Stratejisi: İki Aşamalı PostgreSQL Advisory Lock (İş Kodu + Global Xbox Upstream 429 Koruması)</span>
        <span>Polling Sıklığı: 30s</span>
      </div>
    </div>
  );
}
