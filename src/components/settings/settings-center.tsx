"use client";

import { useState, useEffect, useRef } from "react";
import {
  Settings,
  ShieldAlert,
  Save,
  RefreshCw,
  PlusCircle,
  Database,
  Layers,
  TrendingDown,
  Bell,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Lock,
  Unlock,
  Download,
  Trash2,
  UploadCloud,
  FileCheck,
  Server,
  Clock,
  Sparkles,
  Loader2,
  Terminal,
} from "lucide-react";
import { SystemSettingsData, SchedulerScheduleInfo } from "@/lib/settings/system-settings";
import type { SyncProgressState } from "@/lib/xbox/sync-progress-tracker";
import Link from "next/link";

interface SystemStats {
  totalGames: number;
  totalHistories: number;
  totalDeals: number;
  totalRelations: number;
  totalUsers: number;
  activeAlerts: number;
  pendingNotifications: number;
  lastSyncRun: {
    status: string;
    startedAt: string | Date;
    finishedAt: string | Date | null;
    productsChecked: number;
    pricesChanged: number;
    errorCount: number;
  } | null;
  relationsByType: { type: string; count: number }[];
  gamesByType: { type: string; count: number }[];
}

export interface BackupItem {
  id: string;
  filename: string;
  mode: "FULL" | "CATALOG";
  status: string;
  sizeBytes: number;
  tablesIncluded: string[];
  startedAt: string;
  completedAt: string | null;
  fileExists: boolean;
  errorSummary?: string | null;
}

interface SettingsCenterProps {
  initialSettings: SystemSettingsData;
  initialStats: SystemStats;
  initialScheduleInfo?: SchedulerScheduleInfo;
  initialBackups?: BackupItem[];
}

export function SettingsCenter({
  initialSettings,
  initialStats,
  initialScheduleInfo,
  initialBackups = [],
}: SettingsCenterProps) {
  const [settings, setSettings] = useState<SystemSettingsData>(initialSettings);
  const [stats, setStats] = useState<SystemStats>(initialStats);
  const [scheduleInfo, setScheduleInfo] = useState<SchedulerScheduleInfo | undefined>(initialScheduleInfo);
  const [backups, setBackups] = useState<BackupItem[]>(initialBackups);

  const [activeTab, setActiveTab] = useState<"general" | "scheduler" | "catalog" | "backup" | "manual">("scheduler");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync / Discovery Actions
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerAction, setTriggerAction] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<{ success: boolean; message: string } | null>(null);
  const [scanPages, setScanPages] = useState<number>(40);
  const [syncProgress, setSyncProgress] = useState<SyncProgressState | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const progressPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Manual Add state
  const [manualInput, setManualInput] = useState("");
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [manualResult, setManualResult] = useState<{
    success: boolean;
    message: string;
    products?: any[];
  } | null>(null);

  // Backup states
  const [backupMode, setBackupMode] = useState<"FULL" | "CATALOG">("FULL");
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Restore states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isValidatingArchive, setIsValidatingArchive] = useState(false);
  const [validationData, setValidationData] = useState<{
    valid: boolean;
    stagedFilename: string;
    originalFilename: string;
    sizeBytes: number;
    format: string;
    entryCount: number;
    tables: string[];
  } | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    counts?: any;
    preRestoreBackup?: string;
  } | null>(null);

  // Save Settings handler
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ayarlar kaydedilemedi.");
      }

      setSettings(data.settings);
      if (data.scheduleInfo) {
        setScheduleInfo(data.scheduleInfo);
      }
      setSaveSuccess("Sistem ayarları ve zamanlayıcı başarıyla kaydedildi.");
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Polling helper
  const pollProgress = async () => {
    try {
      const res = await fetch("/api/settings/sync-progress");
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setSyncProgress(data.progress);
          if (data.progress.isRunning) {
            setIsTriggering(true);
            setTriggerAction(data.progress.action);
          } else {
            setIsTriggering(false);
            setTriggerAction(null);
            if (progressPollingRef.current) {
              clearInterval(progressPollingRef.current);
              progressPollingRef.current = null;
            }
          }
        }
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    pollProgress();
    return () => {
      if (progressPollingRef.current) clearInterval(progressPollingRef.current);
    };
  }, []);

  // Trigger Action handler
  const handleTriggerAction = async (action: "PRICE_SYNC" | "CATALOG_DISCOVERY") => {
    setIsTriggering(true);
    setTriggerAction(action);
    setTriggerMessage(null);

    // Start live progress polling
    if (progressPollingRef.current) clearInterval(progressPollingRef.current);
    progressPollingRef.current = setInterval(pollProgress, 1200);

    try {
      const res = await fetch("/api/settings/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          maxPages: action === "CATALOG_DISCOVERY" ? scanPages : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "İşlem başlatılamadı.");
      }

      setTriggerMessage({
        success: true,
        message: data.message || "İşlem başarıyla tamamlandı.",
      });

      await pollProgress();

      // Refresh settings & stats
      const sRes = await fetch("/api/settings");
      if (sRes.ok) {
        const sData = await sRes.json();
        setSettings(sData.settings);
        setStats(sData.stats);
        if (sData.scheduleInfo) setScheduleInfo(sData.scheduleInfo);
      }
    } catch (err: any) {
      setTriggerMessage({ success: false, message: err.message });
      await pollProgress();
    } finally {
      // Polling continues until progress reports completed
    }
  };

  // Force unlock handler
  const handleForceUnlock = async () => {
    setIsUnlocking(true);
    try {
      const res = await fetch("/api/settings/sync-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FORCE_UNLOCK" }),
      });
      const data = await res.json();
      if (res.ok) {
        setTriggerMessage({ success: true, message: data.message || "Kilit başarıyla sıfırlandı." });
        setSyncProgress(null);
        setIsTriggering(false);
        setTriggerAction(null);
        if (progressPollingRef.current) {
          clearInterval(progressPollingRef.current);
          progressPollingRef.current = null;
        }
      } else {
        throw new Error(data.error || "Kilit sıfırlanamadı.");
      }
    } catch (err: any) {
      setTriggerMessage({ success: false, message: err.message });
    } finally {
      setIsUnlocking(false);
    }
  };

  // Create Backup handler
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupMessage(null);

    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: backupMode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Yedek oluşturulamadı.");
      }

      setBackupMessage({ success: true, text: data.message });

      // Refresh backup list
      const bRes = await fetch("/api/settings/backup");
      if (bRes.ok) {
        const bData = await bRes.json();
        setBackups(bData.backups);
      }
    } catch (err: any) {
      setBackupMessage({ success: false, text: err.message });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Delete Backup handler
  const handleDeleteBackup = async (id: string) => {
    if (!confirm("Bu yedek dosyasını silmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`/api/settings/backup/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBackups((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Validate Archive Upload
  const handleValidateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsValidatingArchive(true);
    setValidationData(null);
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/settings/backup/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Yedek doğrulanamadı.");
      }

      setValidationData(data);
    } catch (err: any) {
      alert(`Arşiv doğrulama hatası: ${err.message}`);
    } finally {
      setIsValidatingArchive(false);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!validationData || restoreConfirmation !== "RESTORE") return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stagedFilename: validationData.stagedFilename,
          confirmation: restoreConfirmation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Geri yükleme başarısız.");
      }

      setRestoreResult({
        success: true,
        message: data.message,
        counts: data.counts,
        preRestoreBackup: data.preRestoreBackupFilename,
      });

      // Refresh all stats
      const sRes = await fetch("/api/settings");
      if (sRes.ok) {
        const sData = await sRes.json();
        setSettings(sData.settings);
        setStats(sData.stats);
      }
    } catch (err: any) {
      setRestoreResult({ success: false, message: err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  // Manual Add handler
  const handleManualAdd = async () => {
    if (!manualInput.trim()) return;
    setIsManualAdding(true);
    setManualResult(null);

    try {
      const productIds = manualInput
        .split(/[\n, ]+/)
        .map((id) => id.trim().toUpperCase())
        .filter(Boolean);

      if (productIds.length === 0) {
        throw new Error("Lütfen en az bir geçerli BigId girin.");
      }

      const res = await fetch("/api/settings/manual-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ürün ekleme başarısız.");
      }

      setManualResult({
        success: true,
        message: data.message,
        products: data.products,
      });
      setManualInput("");
    } catch (err: any) {
      setManualResult({ success: false, message: err.message });
    } finally {
      setIsManualAdding(false);
    }
  };

  const navItems: {
    id: "scheduler" | "backup" | "catalog" | "general" | "manual";
    title: string;
    subtitle: string;
    icon: any;
  }[] = [
    {
      id: "scheduler",
      title: "Zamanlayıcı & Keşif",
      subtitle: "Otomatik tarama & senkron",
      icon: Clock,
    },
    {
      id: "backup",
      title: "Yedekleme & Veri",
      subtitle: "pg_dump & geri yükleme",
      icon: Database,
    },
    {
      id: "catalog",
      title: "Katalog & Kapsam",
      subtitle: "Oyun, paket & DLC filtreleri",
      icon: Layers,
    },
    {
      id: "general",
      title: "Genel Ayarlar",
      subtitle: "Üyelik & sistem erişimi",
      icon: Settings,
    },
    {
      id: "manual",
      title: "Manuel Ürün Ekle",
      subtitle: "BigId ile hızlı aktarım",
      icon: PlusCircle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Responsive Bento Grid Navigation Selector (No horizontal overflow) */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
        role="tablist"
        aria-label="Ayarlar Bölümleri"
      >
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isLastOddOnMobile = idx === navItems.length - 1;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(item.id)}
              className={`group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                isLastOddOnMobile ? "col-span-2 sm:col-span-1" : ""
              } ${
                isActive
                  ? "border-emerald-500/60 bg-emerald-950/30 text-white shadow-md shadow-emerald-950/30"
                  : "border-zinc-800/90 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  isActive
                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 group-hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-bold truncate ${
                    isActive ? "text-emerald-400" : "text-zinc-200"
                  }`}
                >
                  {item.title}
                </p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                  {item.subtitle}
                </p>
              </div>
              {isActive && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Global Alerts */}
      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-950/40 border border-emerald-800/80 p-3.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-3 rounded-lg bg-red-950/40 border border-red-800/80 p-3.5 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{saveError}</span>
        </div>
      )}

      {/* TAB 1: SCHEDULER & DISCOVERY */}
      {activeTab === "scheduler" && (
        <div className="space-y-6">
          {/* Action Trigger Banner */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-start sm:items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              <span>Anlık Tetikleme & Senkronizasyon (PostgreSQL Advisory Lock Korumalı)</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Zamanlayıcıyı beklemeden mağaza katalog taramasını veya mevcut oyunların fiyat geçmişi güncellemesini hemen çalıştırabilirsiniz.
            </p>

            {/* Scope Selection */}
            <div className="mb-4 rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  Katalog Tarama Derinliği (Sayfa Sayısı):
                </span>
                <span className="text-[11px] text-zinc-400">
                  Her sayfa 25 oyun içerir (40 sayfa ≈ 1.000 oyun).
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { pages: 5, label: "5 Sayfa", desc: "~125 Oyun", badge: "Hızlı Test" },
                  { pages: 20, label: "20 Sayfa", desc: "~500 Oyun", badge: "Standart" },
                  { pages: 40, label: "40 Sayfa", desc: "~1.000 Oyun", badge: "Önerilen" },
                  { pages: 80, label: "80 Sayfa", desc: "~2.000 Oyun", badge: "Tam Katalog" },
                ].map((tier) => (
                  <button
                    key={tier.pages}
                    type="button"
                    disabled={isTriggering}
                    onClick={() => setScanPages(tier.pages)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs text-left transition-all border ${
                      scanPages === tier.pages
                        ? "border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold shadow-sm"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{tier.label}</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-normal">
                        {tier.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{tier.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                <button
                  onClick={() => handleTriggerAction("CATALOG_DISCOVERY")}
                  disabled={isTriggering}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isTriggering && triggerAction === "CATALOG_DISCOVERY" ? "animate-spin" : ""}`} />
                  <span>Şimdi Yeni Oyunları Tara ({scanPages * 25} Ürün)</span>
                </button>

                <button
                  onClick={() => handleTriggerAction("PRICE_SYNC")}
                  disabled={isTriggering}
                  className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 sm:py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-all border border-zinc-700"
                >
                  <TrendingDown className={`h-3.5 w-3.5 shrink-0 ${isTriggering && triggerAction === "PRICE_SYNC" ? "animate-spin" : ""}`} />
                  <span>Şimdi Fiyatları Güncelle</span>
                </button>
              </div>

              {/* Force Unlock Button */}
              <button
                type="button"
                onClick={handleForceUnlock}
                disabled={isUnlocking}
                className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 hover:text-amber-400 border border-zinc-800 hover:border-amber-800/60 rounded-lg px-2.5 py-1.5 transition-colors"
                title="Arka planda kilit takılı kaldıysa sıfırlar"
              >
                <Lock className={`h-3 w-3 ${isUnlocking ? "animate-spin" : ""}`} />
                <span>{isUnlocking ? "Kilit Açılıyor..." : "Kilidi Sıfırla (Force Unlock)"}</span>
              </button>
            </div>

            {/* Live Progress Bar & Activity Feed */}
            {syncProgress && (syncProgress.isRunning || syncProgress.status === "FAILED" || syncProgress.status === "COMPLETED") && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {syncProgress.isRunning ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    ) : syncProgress.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    )}
                    <span className="font-semibold text-white">
                      {syncProgress.action === "CATALOG_DISCOVERY" ? "Katalog Keşfi" : "Fiyat Senkronizasyonu"}
                      {syncProgress.isRunning ? " Devam Ediyor..." : syncProgress.status === "COMPLETED" ? " Tamamlandı" : " Hata ile Sonlandı"}
                    </span>
                  </div>
                  <div className="font-mono text-emerald-400 font-bold text-xs">
                    %{syncProgress.progressPercent}
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      syncProgress.status === "FAILED"
                        ? "bg-red-500"
                        : syncProgress.status === "COMPLETED"
                        ? "bg-emerald-500"
                        : "bg-emerald-500 animate-pulse"
                    }`}
                    style={{ width: `${Math.max(syncProgress.progressPercent, 3)}%` }}
                  />
                </div>

                <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>{syncProgress.currentPhase}</span>
                  {syncProgress.startedAt && (
                    <span className="text-[10px] text-zinc-500" suppressHydrationWarning>
                      Başlangıç: {new Date(syncProgress.startedAt).toLocaleTimeString("tr-TR")}
                    </span>
                  )}
                </div>

                {/* Real-time KPI counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800/80 p-2 text-center">
                    <span className="text-[10px] text-zinc-500 block">Taranan Sayfa</span>
                    <span className="text-xs font-bold text-zinc-200">
                      {syncProgress.currentPage} / {syncProgress.totalPages}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800/80 p-2 text-center">
                    <span className="text-[10px] text-zinc-500 block">Keşfedilen Ürün</span>
                    <span className="text-xs font-bold text-white">
                      {syncProgress.totalDiscovered}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800/80 p-2 text-center">
                    <span className="text-[10px] text-zinc-500 block">Yeni Eklenen</span>
                    <span className="text-xs font-bold text-emerald-400">
                      +{syncProgress.newItemsAdded}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800/80 p-2 text-center">
                    <span className="text-[10px] text-zinc-500 block">Güncellenen</span>
                    <span className="text-xs font-bold text-blue-400">
                      {syncProgress.itemsUpdated}
                    </span>
                  </div>
                </div>

                {/* Live Activity Console */}
                {syncProgress.logs && syncProgress.logs.length > 0 && (
                  <div className="mt-2 rounded-lg bg-zinc-900/90 border border-zinc-800 p-2.5 max-h-36 overflow-y-auto font-mono text-[10px] space-y-1 text-zinc-400">
                    {syncProgress.logs.slice(-6).map((log, i) => (
                      <div key={i} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-zinc-600 select-none">&gt;</span>
                        <span className="text-zinc-300">{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {triggerMessage && (
              <div className={`mt-4 rounded-lg p-3 text-xs flex items-center gap-2 ${triggerMessage.success ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-300" : "bg-red-950/40 border border-red-800/80 text-red-300"}`}>
                {triggerMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{triggerMessage.message}</span>
              </div>
            )}
          </div>

          {/* Schedule Status & Telemetry Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[11px] font-medium text-zinc-400">Son Katalog Taraması</span>
              <p className="mt-1 text-sm font-semibold text-white" suppressHydrationWarning>
                {scheduleInfo?.lastCatalogDiscoveryAt ? new Date(scheduleInfo.lastCatalogDiscoveryAt).toLocaleString("tr-TR") : "Henüz yapılmadı"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[11px] font-medium text-zinc-400">Sıradaki Katalog Taraması</span>
              <p className="mt-1 text-sm font-semibold text-emerald-400" suppressHydrationWarning>
                {scheduleInfo?.nextCatalogDiscoveryAt ? new Date(scheduleInfo.nextCatalogDiscoveryAt).toLocaleString("tr-TR") : "Devre Dışı"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[11px] font-medium text-zinc-400">Son Fiyat Senkronizasyonu</span>
              <p className="mt-1 text-sm font-semibold text-white" suppressHydrationWarning>
                {scheduleInfo?.lastPriceSyncAt ? new Date(scheduleInfo.lastPriceSyncAt).toLocaleString("tr-TR") : "Henüz yapılmadı"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-[11px] font-medium text-zinc-400">Sıradaki Fiyat Senkronizasyonu</span>
              <p className="mt-1 text-sm font-semibold text-emerald-400" suppressHydrationWarning>
                {scheduleInfo?.nextPriceSyncAt ? new Date(scheduleInfo.nextPriceSyncAt).toLocaleString("tr-TR") : "Devre Dışı"}
              </p>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
            <h3 className="text-base font-semibold text-white border-b border-zinc-800 pb-3">
              Xbox Series X|S Zamanlayıcı Yapılandırması
            </h3>

            {/* Switch: autoDiscoverSeriesCatalog */}
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <span className="text-sm font-medium text-white">Otomatik Xbox Series X|S Katalog Keşfi</span>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Türkiye Xbox Store&apos;daki yeni ve geri-katalog Series X|S oyunlarını periyodik olarak otomatik tarar.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoDiscoverSeriesCatalog}
                  onChange={(e) => setSettings({ ...settings, autoDiscoverSeriesCatalog: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800/80">
              {/* Catalog Discovery Interval */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Katalog Keşif Aralığı (Saat)
                </label>
                <select
                  value={settings.catalogDiscoveryIntervalHours}
                  onChange={(e) => setSettings({ ...settings, catalogDiscoveryIntervalHours: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value={12}>12 Saat (Günde 2 kez)</option>
                  <option value={24}>24 Saat (Önerilen - Günde 1 kez)</option>
                  <option value={48}>48 Saat (2 günde 1 kez)</option>
                  <option value={72}>72 Saat (3 günde 1 kez)</option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Series X|S mağaza kanalındaki yeni ürünleri tarama sıklığı.
                </span>
              </div>

              {/* Price Sync Interval */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Fiyat Senkronizasyon Aralığı (Saat)
                </label>
                <select
                  value={settings.priceSyncIntervalHours}
                  onChange={(e) => setSettings({ ...settings, priceSyncIntervalHours: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value={2}>2 Saat (Sık takip)</option>
                  <option value={6}>6 Saat (Önerilen)</option>
                  <option value={12}>12 Saat</option>
                  <option value={24}>24 Saat (Günde 1 kez)</option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Mevcut kayıtlı oyunların anlık fiyat değişimlerini kontrol etme sıklığı.
                </span>
              </div>

              {/* Metadata Refresh Interval */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Metaveri Yenileme Aralığı (Saat)
                </label>
                <select
                  value={settings.metadataRefreshIntervalHours}
                  onChange={(e) => setSettings({ ...settings, metadataRefreshIntervalHours: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value={72}>72 Saat (3 gün)</option>
                  <option value={168}>168 Saat (Önerilen - Haftalık)</option>
                  <option value={336}>336 Saat (2 haftalık)</option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Açıklama, görseller ve tür bilgilerini ağır güncelleme sıklığı.
                </span>
              </div>

              {/* Relationship Refresh Interval */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  İlişki (Paket/DLC) Yenileme Aralığı (Saat)
                </label>
                <select
                  value={settings.relationshipRefreshIntervalHours}
                  onChange={(e) => setSettings({ ...settings, relationshipRefreshIntervalHours: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value={72}>72 Saat (3 gün)</option>
                  <option value={168}>168 Saat (Önerilen - Haftalık)</option>
                  <option value={336}>336 Saat (2 haftalık)</option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Paket içi oyunlar ve ana oyun DLC bağlantılarını yenileme sıklığı.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Kaydediliyor..." : "Zamanlayıcı Ayarlarını Kaydet"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BACKUP & RESTORE CENTER */}
      {activeTab === "backup" && (
        <div className="space-y-6">
          {/* Backup Creator Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>PostgreSQL Veritabanı Yedeği Oluştur (pg_dump -Fc)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Veritabanını sıkıştırılmış PostgreSQL custom arşiv biçiminde sunucu tarafında güvenle yedekler.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <label
                onClick={() => setBackupMode("FULL")}
                className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-all ${
                  backupMode === "FULL"
                    ? "border-emerald-500/80 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="backupMode"
                  checked={backupMode === "FULL"}
                  onChange={() => setBackupMode("FULL")}
                  className="mt-0.5 text-emerald-600"
                />
                <div>
                  <span className="text-xs font-semibold text-white">Tam Yedek (FULL BACKUP)</span>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Oyunlar, fiyat geçmişi, analizler, ilişkiler, kullanıcılar, favoriler, istek listesi ve bildirimler dahil tüm veritabanı.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setBackupMode("CATALOG")}
                className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-all ${
                  backupMode === "CATALOG"
                    ? "border-emerald-500/80 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="backupMode"
                  checked={backupMode === "CATALOG"}
                  onChange={() => setBackupMode("CATALOG")}
                  className="mt-0.5 text-emerald-600"
                />
                <div>
                  <span className="text-xs font-semibold text-white">Katalog Yedeği (CATALOG ONLY)</span>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Yalnızca oyun kataloğu, fiyat geçmişi ve paket ilişkileri (kişisel kullanıcı verileri ve şifreler hariç).
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
              <span className="text-xs text-zinc-400">
                Mevcut kayıt: <strong className="text-white">{stats.totalGames} Oyun</strong>,{" "}
                <strong className="text-white">{stats.totalHistories} Fiyat Geçmişi</strong>,{" "}
                <strong className="text-white">{stats.totalRelations} İlişki</strong>
              </span>

              <button
                onClick={handleCreateBackup}
                disabled={isCreatingBackup}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
              >
                <Download className={`h-4 w-4 shrink-0 ${isCreatingBackup ? "animate-bounce" : ""}`} />
                <span>{isCreatingBackup ? "Yedek Alınıyor..." : "Veritabanı Yedeği Oluştur"}</span>
              </button>
            </div>

            {backupMessage && (
              <div className={`mt-3 rounded-lg p-3 text-xs flex items-center gap-2 ${backupMessage.success ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-300" : "bg-red-950/40 border border-red-800/80 text-red-300"}`}>
                {backupMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{backupMessage.text}</span>
              </div>
            )}
          </div>

          {/* Backup History Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-white border-b border-zinc-800 pb-3">
              Kayıtlı Yedek Dosyaları ({backups.length})
            </h3>

            {backups.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                Henüz kayıtlı bir veritabanı yedeği bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="pb-2">Dosya Adı</th>
                      <th className="pb-2">Mod</th>
                      <th className="pb-2">Boyut</th>
                      <th className="pb-2">Oluşturulma</th>
                      <th className="pb-2">Durum</th>
                      <th className="pb-2 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {backups.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-850/40">
                        <td className="py-2.5 font-mono text-zinc-300 text-[11px]">{b.filename}</td>
                        <td className="py-2.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${b.mode === "FULL" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50" : "bg-blue-950 text-blue-400 border border-blue-800/50"}`}>
                            {b.mode}
                          </span>
                        </td>
                        <td className="py-2.5 text-zinc-400">
                          {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </td>
                        <td className="py-2.5 text-zinc-400" suppressHydrationWarning>
                          {new Date(b.startedAt).toLocaleString("tr-TR")}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[11px] font-medium ${b.status === "COMPLETED" ? "text-emerald-400" : "text-amber-400"}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right space-x-2">
                          <a
                            href={`/api/settings/backup/download/${b.filename}`}
                            download
                            className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
                          >
                            <Download className="h-3 w-3" />
                            İndir
                          </a>
                          <button
                            onClick={() => handleDeleteBackup(b.id)}
                            className="inline-flex items-center gap-1 rounded bg-red-950/40 text-red-400 px-2 py-1 text-[11px] font-medium hover:bg-red-900/60 border border-red-900/50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Restore / Import Card */}
          <div className="rounded-xl border border-amber-900/40 bg-zinc-900/50 p-4 sm:p-6 space-y-4">
            <div className="border-b border-amber-900/30 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Yedekten Geri Yükle (pg_restore)</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                PostgreSQL custom format (.dump veya .backup) arşivini yükleyip güvenle geri yükleyin.
              </p>
            </div>

            <div className="rounded-lg bg-amber-950/20 border border-amber-800/40 p-3 text-xs text-amber-300/90 leading-relaxed">
              <strong>Önemli Güvenlik Kuralı:</strong> Geri yükleme işlemi mevcut veritabanı içeriğini değiştirecektir.
              Sistem geri yükleme öncesinde otomatik olarak tam bir güvenlik yedeği (pre-restore backup) alacak ve işlem süresince advisory lock ile tüm senkronizasyonları askıya alacaktır.
            </div>

            {/* Step 1: File Upload & Validation */}
            <form onSubmit={handleValidateUpload} className="space-y-3">
              <label className="block text-xs font-medium text-zinc-300">
                1. Yedek Dosyası Seç (.dump veya .backup):
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  type="file"
                  accept=".dump,.backup"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
                    setValidationData(null);
                  }}
                  className="block w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
                <button
                  type="submit"
                  disabled={!uploadFile || isValidatingArchive}
                  className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2.5 sm:py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>{isValidatingArchive ? "Doğrulanıyor..." : "Arşivi İncele"}</span>
                </button>
              </div>
            </form>

            {/* Step 2: Archive Inspection Summary */}
            {validationData && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Arşiv Doğrulandı ({validationData.format})
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {(validationData.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>

                <div className="text-xs text-zinc-300">
                  <span className="text-zinc-500">İçerilen Tablolar:</span>{" "}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {validationData.tables.map((t) => (
                      <span key={t} className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Step 3: Explicit Confirmation */}
                <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                  <label className="block text-xs font-medium text-amber-300">
                    2. Geri Yüklemeyi Onaylamak İçin Aşağıya <strong className="underline font-mono">RESTORE</strong> Yazın:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="RESTORE"
                      value={restoreConfirmation}
                      onChange={(e) => setRestoreConfirmation(e.target.value)}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 sm:py-1.5 text-xs text-white font-mono uppercase tracking-widest focus:border-amber-500 focus:outline-none w-full sm:w-48"
                    />
                    <button
                      onClick={handleExecuteRestore}
                      disabled={restoreConfirmation !== "RESTORE" || isRestoring}
                      className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40 transition-all shadow-sm"
                    >
                      <Database className={`h-4 w-4 ${isRestoring ? "animate-spin" : ""}`} />
                      <span>{isRestoring ? "Geri Yükleniyor (Bekleyiniz)..." : "Geri Yüklemeyi Başlat"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Restore Result Notice */}
            {restoreResult && (
              <div className={`rounded-lg p-4 text-xs space-y-2 ${restoreResult.success ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300" : "bg-red-950/40 border border-red-800 text-red-300"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {restoreResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>{restoreResult.message}</span>
                </div>
                {restoreResult.counts && (
                  <p className="text-[11px] text-zinc-300">
                    Doğrulanan Sayımlar: {restoreResult.counts.games} Oyun, {restoreResult.counts.priceHistories} Fiyat Geçmişi, {restoreResult.counts.gameRelations} İlişki.
                  </p>
                )}
                {restoreResult.preRestoreBackup && (
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Güvenlik Yedeği: {restoreResult.preRestoreBackup}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CATALOG & SCOPE RULES */}
      {activeTab === "catalog" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
          <h3 className="text-base font-semibold text-white border-b border-zinc-800 pb-3">
            Katalog Kapsam & Takip Kuralları
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-medium text-white">Ana Oyunlar (BASE_GAME)</span>
                <p className="text-[11px] text-zinc-400">Standart ve özel sürüm ana oyunlar.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.trackBaseGames}
                onChange={(e) => setSettings({ ...settings, trackBaseGames: e.target.checked })}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-medium text-white">Paketler & Koleksiyonlar (BUNDLE)</span>
                <p className="text-[11px] text-zinc-400">Birden fazla oyun içeren paketler.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.trackBundles}
                onChange={(e) => setSettings({ ...settings, trackBundles: e.target.checked })}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-medium text-white">DLC & Eklentiler</span>
                <p className="text-[11px] text-zinc-400">İndirilebilir içerikler ve genişletmeler.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.trackDlc}
                onChange={(e) => setSettings({ ...settings, trackDlc: e.target.checked })}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-medium text-white">Genişletme Paketleri (EXPANSION)</span>
                <p className="text-[11px] text-zinc-400">Büyük ek haritalar ve hikaye içerikleri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.trackExpansions}
                onChange={(e) => setSettings({ ...settings, trackExpansions: e.target.checked })}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-medium text-white">Sezon Biletleri (SEASON_PASS)</span>
                <p className="text-[11px] text-zinc-400">Gelecek tüm DLC&apos;leri kapsayan sezon biletleri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.trackSeasonPasses}
                onChange={(e) => setSettings({ ...settings, trackSeasonPasses: e.target.checked })}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-xs font-medium text-white">Kozmetik ve İçerik Paketleri (CONTENT_PACK)</span>
                <p className="text-[11px] text-zinc-400">Kıyafet, silah ve skin paketleri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.trackContentPacks}
                onChange={(e) => setSettings({ ...settings, trackContentPacks: e.target.checked })}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-0"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Kaydediliyor..." : "Katalog Kurallarını Kaydet"}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
          <h3 className="text-base font-semibold text-white border-b border-zinc-800 pb-3">
            Genel Uygulama Ayarları
          </h3>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-white">Kullanıcı Kaydına İzin Ver</span>
              <p className="text-xs text-zinc-400 mt-0.5">
                Yeni kullanıcıların /register sayfasından hesap oluşturmasına izin verilsin mi?
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowRegistration}
                onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: MANUAL ADD */}
      {activeTab === "manual" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <h3 className="text-base font-semibold text-white border-b border-zinc-800 pb-3">
            Manuel Microsoft BigId İçe Aktarımı
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Xbox veya Microsoft Store ürün BigId kodlarını (ör: 9NWQ1Q1FR0C9, 9N6N6K5H99R6) girerek Display Catalog üzerinden anında ekleyebilir ve paket ilişkilerini bağlayabilirsiniz.
          </p>

          <textarea
            rows={4}
            placeholder="9NWQ1Q1FR0C9, 9N6N6K5H99R6..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs text-zinc-200 font-mono focus:border-emerald-500 focus:outline-none"
          />

          <div className="flex justify-end">
            <button
              onClick={handleManualAdd}
              disabled={isManualAdding || !manualInput.trim()}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{isManualAdding ? "İçe Aktarılıyor..." : "Ürünleri İçe Aktar"}</span>
            </button>
          </div>

          {manualResult && (
            <div className={`mt-3 rounded-lg p-3 text-xs ${manualResult.success ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-300" : "bg-red-950/40 border border-red-800/80 text-red-300"}`}>
              <span>{manualResult.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
