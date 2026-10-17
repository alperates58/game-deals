"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  ShieldAlert,
  FileCheck,
} from "lucide-react";

interface BackupItem {
  id: string;
  filename: string;
  mode: "FULL" | "CATALOG";
  status?: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "RESTORING";
  sizeBytes: number;
  rowCountEstimate?: number;
  tablesIncluded?: string[];
  startedAt?: string;
  createdAt?: string;
  completedAt?: string | null;
  fileExists?: boolean;
  errorSummary?: string | null;
  itemCounts?: {
    games?: number;
    prices?: number;
    relations?: number;
    users?: number;
  };
}

export function BackupClient() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [currentCounts, setCurrentCounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/backup");
      const data = await res.json();
      if (res.ok) {
        setBackups(data.backups || []);
        setCurrentCounts(data.currentCounts || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async (mode: "FULL" | "CATALOG") => {
    setCreating(mode);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yedek alınamadı");
      setMessage({ text: `${mode} yedek başarıyla oluşturuldu!`, type: "success" });
      await fetchBackups();
    } catch (err: any) {
      setMessage({ text: err.message || "Hata oluştu", type: "error" });
    } finally {
      setCreating(null);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm("Bu yedeği kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/settings/backup/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Yedek silinemedi");
      await fetchBackups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestore = async (b: BackupItem) => {
    const confirmation = prompt(
      `DİKKAT: Veritabanı geri yükleme işlemi mevcut verilerin üzerine yazacaktır.\n` +
      `İşlem öncesinde otomatik bir güvenlik yedeği alınacaktır.\n\n` +
      `Devam etmek için "GERI YUKLE" yazınız:`
    );
    if (confirmation !== "GERI YUKLE") {
      return;
    }

    setRestoringId(b.id);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: b.filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Geri yükleme başarısız");
      setMessage({ text: "Veritabanı başarıyla geri yüklendi!", type: "success" });
      await fetchBackups();
    } catch (err: any) {
      setMessage({ text: err.message || "Geri yükleme hatası", type: "error" });
    } finally {
      setRestoringId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

      {/* Database Current Stats */}
      {currentCounts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <span className="text-[11px] text-zinc-400 block">Katalog Oyunları</span>
            <span className="text-xl font-bold text-white font-mono mt-1 block">
              {currentCounts.gameCount}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <span className="text-[11px] text-zinc-400 block">Fiyat Kayıtları</span>
            <span className="text-xl font-bold text-white font-mono mt-1 block">
              {currentCounts.priceHistoryCount}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <span className="text-[11px] text-zinc-400 block">İlişki Eşlemeleri</span>
            <span className="text-xl font-bold text-white font-mono mt-1 block">
              {currentCounts.relationCount}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <span className="text-[11px] text-zinc-400 block">Kullanıcı Hesapları</span>
            <span className="text-xl font-bold text-white font-mono mt-1 block">
              {currentCounts.userCount}
            </span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            <span>Yeni Yedek Oluştur</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tam sistem veya yalnızca katalog verisi JSON yedeği oluşturun.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={Boolean(creating)}
            onClick={() => handleCreateBackup("CATALOG")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors disabled:opacity-50"
          >
            {creating === "CATALOG" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            <span>Katalog Yedeği</span>
          </button>

          <button
            type="button"
            disabled={Boolean(creating)}
            onClick={() => handleCreateBackup("FULL")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
          >
            {creating === "FULL" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            <span>Tam Sistem Yedeği</span>
          </button>
        </div>
      </div>

      {/* Backups Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Tarih</th>
              <th className="py-3 px-4">Dosya Adı</th>
              <th className="py-3 px-4">Kapsam / Durum</th>
              <th className="py-3 px-4">Boyut</th>
              <th className="py-3 px-4">İçerik</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Yedekler yükleniyor...
                </td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  Henüz oluşturulmuş bir yedek dosyası bulunmuyor.
                </td>
              </tr>
            ) : (
              backups.map((b) => {
                const dateStr = b.startedAt || b.createdAt;
                const formattedDate = dateStr ? new Date(dateStr).toLocaleString("tr-TR") : "Belirtilmedi";
                const isAvailable = b.fileExists !== false;

                return (
                  <tr key={b.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-200">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px] sm:max-w-xs">{b.filename}</span>
                        {!isAvailable && (
                          <span className="rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 text-[9px]">
                            Disk Kaydı Yok
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            b.mode === "FULL"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {b.mode}
                        </span>

                        {b.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Başarılı
                          </span>
                        )}
                        {b.status === "IN_PROGRESS" && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Alınıyor
                          </span>
                        )}
                        {b.status === "FAILED" && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-medium" title={b.errorSummary || "Yedekleme hatası"}>
                            <AlertTriangle className="h-2.5 w-2.5" /> Hata
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                      {formatSize(b.sizeBytes || 0)}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-zinc-400 font-mono whitespace-nowrap">
                      {b.itemCounts?.games !== undefined ? (
                        `${b.itemCounts.games} oyun / ${b.itemCounts.prices ?? 0} fiyat`
                      ) : b.rowCountEstimate ? (
                        `~${b.rowCountEstimate.toLocaleString("tr-TR")} satır (${b.tablesIncluded?.length || 0} tablo)`
                      ) : b.tablesIncluded && b.tablesIncluded.length > 0 ? (
                        `${b.tablesIncluded.length} tablo`
                      ) : (
                        "Veritabanı Yedeği"
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {isAvailable ? (
                          <a
                            href={`/api/settings/backup/download/${b.filename}`}
                            download
                            className="rounded bg-zinc-800 hover:bg-zinc-700 p-1.5 text-zinc-300 transition-colors"
                            title="İndir"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : null}

                        {isAvailable && (
                          <button
                            type="button"
                            disabled={restoringId === b.id}
                            onClick={() => handleRestore(b)}
                            className="rounded bg-amber-950 border border-amber-700/60 hover:bg-amber-900 p-1.5 text-amber-300 transition-colors disabled:opacity-50"
                            title="Geri Yükle"
                          >
                            {restoringId === b.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteBackup(b.id)}
                          className="rounded bg-red-950/60 border border-red-800/40 hover:bg-red-900 p-1.5 text-red-400 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
