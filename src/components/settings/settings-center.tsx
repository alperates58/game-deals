"use client";

import { useState } from "react";
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
} from "lucide-react";
import { SystemSettingsData } from "@/lib/settings/system-settings";
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

interface SettingsCenterProps {
  initialSettings: SystemSettingsData;
  initialStats: SystemStats;
}

export function SettingsCenter({ initialSettings, initialStats }: SettingsCenterProps) {
  const [settings, setSettings] = useState<SystemSettingsData>(initialSettings);
  const [stats, setStats] = useState<SystemStats>(initialStats);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync Now state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLimit, setSyncLimit] = useState<number>(0);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Manual Add state
  const [manualInput, setManualInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addedGame, setAddedGame] = useState<any | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setSaveSuccess("Sistem ayarları başarıyla kaydedildi.");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/settings/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: syncLimit > 0 ? syncLimit : undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Senkronizasyon başarısız oldu.");
      }

      setSyncResult({ success: true, message: data.message });
      // Refresh stats
      const statsRes = await fetch("/api/settings");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.stats) setStats(statsData.stats);
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setIsAdding(true);
    setAddError(null);
    setAddedGame(null);

    try {
      const res = await fetch("/api/settings/manual-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: manualInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ürün eklenemedi.");
      }

      setAddedGame(data.game);
      setManualInput("");
      // Refresh stats
      const statsRes = await fetch("/api/settings");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.stats) setStats(statsData.stats);
      }
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Alert Notices */}
      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-4 text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span className="text-sm font-medium">{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-800/80 bg-red-950/40 p-4 text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <span className="text-sm font-medium">{saveError}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Genel & Kayıt Kontrolü */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
            <ShieldAlert className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Genel & Kayıt Kontrolü</h2>
              <p className="text-xs text-zinc-400">
                Site kişisel kullanım ve kontrollü erişim odaklıdır. Kayıt politikasını buradan yönetebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
            <div>
              <label htmlFor="allowRegistration" className="text-sm font-medium text-white block cursor-pointer">
                Yeni Kullanıcı Kaydına İzin Ver (ALLOW_REGISTRATION)
              </label>
              <p className="text-xs text-zinc-400 mt-0.5">
                Kapalı olduğunda /register sayfası yeni hesap oluşturulmasını engeller ve kullanıcılara bilgi verir.
              </p>
            </div>
            <input
              type="checkbox"
              id="allowRegistration"
              checked={settings.allowRegistration}
              onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
              className="h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Section 2: Katalog & Takip Kapsamı */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
            <Layers className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Katalog & Takip Kapsamı</h2>
              <p className="text-xs text-zinc-400">
                Hangi ürün sınıflarının senkronize edileceğini ve takip listesinde tutulacağını belirleyin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "trackBaseGames", label: "Ana Oyunlar (BASE_GAME)", desc: "Standart tam oyunlar" },
              { key: "trackBundles", label: "Oyun Paketleri (BUNDLE)", desc: "Birden fazla oyun içeren paketler" },
              { key: "trackDlc", label: "İndirilebilir İçerik (DLC)", desc: "Hikaye ve ek görev paketleri" },
              { key: "trackExpansions", label: "Genişleme Paketleri (EXPANSION)", desc: "Büyük ek paketler" },
              { key: "trackSeasonPasses", label: "Sezon Biletleri (SEASON_PASS)", desc: "Sezon geçişleri" },
              { key: "trackAddons", label: "Eklentiler (ADD_ON)", desc: "Genel eklenti içerikleri" },
              { key: "trackContentPacks", label: "İçerik Paketleri (CONTENT_PACK)", desc: "Kozmetik ve içerik paketleri" },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60 cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={(settings as any)[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-white block">{label}</span>
                  <span className="text-[11px] text-zinc-500">{desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Section 3: Keşif & İlişki Algılama */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
            <RefreshCw className="h-5 w-5 text-purple-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Keşif & İlişki Algılama</h2>
              <p className="text-xs text-zinc-400">
                Microsoft Catalog üzerinden bundle içerikleri ve ilişkili DLC&apos;lerin otomatik keşfi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                key: "autoDiscoverPopular",
                label: "Popüler Oyunları Otomatik Keşfet",
                desc: "Microsoft Store listelerindeki yeni popüler ücretli oyunları tarar.",
              },
              {
                key: "autoDiscoverBundleChildren",
                label: "Paket Alt Oyunlarını Otomatik Keşfet",
                desc: "Eklenen paketlerin içindeki bağımsız oyunları authoritative olarak çözer.",
              },
              {
                key: "autoDiscoverRelatedDlc",
                label: "İlişkili DLC&apos;leri Otomatik Keşfet",
                desc: "Takipteki ana oyunlara ait ek paketleri mağaza metadata&apos;sından bulur.",
              },
              {
                key: "autoAddRelatedProducts",
                label: "İlişkili Ürünleri Otomatik Veritabanına Ekle",
                desc: "Keşfedilen alt ürünleri ve DLC&apos;leri doğrudan fiyat takibine alır.",
              },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60 cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={(settings as any)[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-white block">{label}</span>
                  <span className="text-[11px] text-zinc-500">{desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Section 4: Senkronizasyon Zamanlaması */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
            <Database className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Senkronizasyon Zamanlaması</h2>
              <p className="text-xs text-zinc-400">
                Arka plan worker servisinin katalog fiyatlarını ne sıklıkla kontrol edeceğini belirleyin.
              </p>
            </div>
          </div>

          <div className="max-w-xs">
            <label htmlFor="syncInterval" className="text-xs font-medium text-zinc-300 block mb-2">
              Otomatik Senkronizasyon Aralığı
            </label>
            <select
              id="syncInterval"
              value={settings.syncIntervalHours}
              onChange={(e) => setSettings({ ...settings, syncIntervalHours: parseInt(e.target.value, 10) })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value={1}>Her 1 Saatte Bir</option>
              <option value={3}>Her 3 Saatte Bir</option>
              <option value={6}>Her 6 Saatte Bir (Önerilen)</option>
              <option value={12}>Her 12 Saatte Bir</option>
              <option value={24}>Her 24 Saatte Bir (Günde 1 Kez)</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </button>
          </div>
        </div>
      </form>

      {/* Section 5: Manuel Fiyat Senkronizasyonu */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
          <RefreshCw className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Şimdi Fiyatları Kontrol Et (Advisory Lock Korumalı)</h2>
            <p className="text-xs text-zinc-400">
              Katalogdaki aktif oyunların fiyatlarını Microsoft Catalog API üzerinden hemen günceller ve alarmları tetikler.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-48">
            <label htmlFor="syncLimit" className="text-xs text-zinc-400 block mb-1">
              Kontrol Edilecek Adet:
            </label>
            <select
              id="syncLimit"
              value={syncLimit}
              onChange={(e) => setSyncLimit(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value={0}>Tüm Katalog ({stats.totalGames} Ürün)</option>
              <option value={25}>İlk 25 Ürün (Hızlı Test)</option>
              <option value={50}>İlk 50 Ürün</option>
              <option value={100}>İlk 100 Ürün</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="mt-5 flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Senkronize Ediliyor..." : "Senkronizasyonu Başlat"}
          </button>
        </div>

        {syncResult && (
          <div
            className={`mt-4 rounded-lg p-3 text-xs font-medium border ${
              syncResult.success
                ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-300"
                : "border-red-800/80 bg-red-950/40 text-red-300"
            }`}
          >
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Section 6: Manuel Ürün Ekleme */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
          <PlusCircle className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Microsoft Store Ürünü Ekle</h2>
            <p className="text-xs text-zinc-400">
              Xbox Store URL&apos;si veya 12 haneli BigId girerek kataloğa yeni bir oyun veya paket ekleyin.
            </p>
          </div>
        </div>

        <form onSubmit={handleManualAdd} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Örn: 9NBLGGH42CFD veya https://www.xbox.com/tr-tr/games/store/.../9NBLGGH42CFD"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isAdding || !manualInput.trim()}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              {isAdding ? "Doğrulanıyor..." : "Ürünü Ekle"}
            </button>
          </div>

          {addError && (
            <div className="rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-xs text-red-300">
              {addError}
            </div>
          )}

          {addedGame && (
            <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{addedGame.title}</h3>
                    <p className="text-xs text-zinc-400">
                      Tür: <span className="text-emerald-400 font-mono">{addedGame.productClass}</span> | Fiyat:{" "}
                      <span className="text-white font-medium">₺{addedGame.currentPrice.toFixed(2)}</span>
                      {addedGame.discoveredChildrenCount > 0 && (
                        <span> | Keşfedilen Alt Ürün: {addedGame.discoveredChildrenCount}</span>
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/oyun/${addedGame.slug}`}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Sayfaya Git
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Section 7: Sistem Durumu & Metrikler */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-5">
          <Database className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Sistem Durumu & Telemetri</h2>
            <p className="text-xs text-zinc-400">
              Veritabanı kayıtları, ilişki bağlantıları ve son senkronizasyon telemetrisi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4">
            <span className="text-xs text-zinc-400 block">Katalogdaki Ürünler</span>
            <span className="text-2xl font-bold text-white mt-1 block">{stats.totalGames}</span>
          </div>

          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4">
            <span className="text-xs text-zinc-400 block">Fiyat Geçmişi Kayıtları</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block">{stats.totalHistories}</span>
          </div>

          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4">
            <span className="text-xs text-zinc-400 block">Fırsat Analizleri</span>
            <span className="text-2xl font-bold text-blue-400 mt-1 block">{stats.totalDeals}</span>
          </div>

          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4">
            <span className="text-xs text-zinc-400 block">İlişki Bağlantıları</span>
            <span className="text-2xl font-bold text-purple-400 mt-1 block">{stats.totalRelations}</span>
          </div>

          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4">
            <span className="text-xs text-zinc-400 block">Aktif Fiyat Alarmları</span>
            <span className="text-2xl font-bold text-amber-400 mt-1 block">{stats.activeAlerts}</span>
          </div>

          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4">
            <span className="text-xs text-zinc-400 block">Kuyruktaki Bildirim Olayları</span>
            <span className="text-2xl font-bold text-indigo-400 mt-1 block">{stats.pendingNotifications}</span>
          </div>

          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-4 col-span-2">
            <span className="text-xs text-zinc-400 block">Son Senkronizasyon</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {stats.lastSyncRun
                  ? `${new Date(stats.lastSyncRun.startedAt).toLocaleString("tr-TR")}`
                  : "Henüz kayıt yok"}
              </span>
              {stats.lastSyncRun && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${
                    stats.lastSyncRun.status === "COMPLETED"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                      : "bg-amber-950 text-amber-400 border border-amber-800/50"
                  }`}
                >
                  {stats.lastSyncRun.status}
                </span>
              )}
            </div>
            {stats.lastSyncRun && (
              <p className="text-[11px] text-zinc-500 mt-1">
                Kontrol: {stats.lastSyncRun.productsChecked} | Değişim: {stats.lastSyncRun.pricesChanged} | Hata:{" "}
                {stats.lastSyncRun.errorCount}
              </p>
            )}
          </div>
        </div>

        {/* Relations Breakdown */}
        {stats.relationsByType.length > 0 && (
          <div className="mt-6 pt-5 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              İlişki Dağılımı (Authoritative Relationships)
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.relationsByType.map((r) => (
                <span
                  key={r.type}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-800"
                >
                  <span className="font-mono text-emerald-400">{r.type}:</span>
                  <span className="font-bold text-white">{r.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
