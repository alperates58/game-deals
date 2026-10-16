"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export function AuditLogClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [actorEmail, setActorEmail] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (actorEmail.trim()) params.set("actorEmail", actorEmail.trim());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotalPages(data.pagination.totalPages || 1);
        setTotal(data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, actorEmail]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Tüm Eylemler</option>
            <option value="SUSPEND_USER">SUSPEND_USER</option>
            <option value="ACTIVATE_USER">ACTIVATE_USER</option>
            <option value="CHANGE_ROLE">CHANGE_ROLE</option>
            <option value="CHANGE_MEMBERSHIP">CHANGE_MEMBERSHIP</option>
            <option value="UPDATE_MANUAL_OVERRIDE">UPDATE_MANUAL_OVERRIDE</option>
            <option value="RESET_MANUAL_OVERRIDE">RESET_MANUAL_OVERRIDE</option>
            <option value="RETRY_NOTIFICATION_DELIVERY">RETRY_NOTIFICATION_DELIVERY</option>
          </select>

          <input
            type="text"
            placeholder="Yönetici e-postası ara..."
            value={actorEmail}
            onChange={(e) => {
              setActorEmail(e.target.value);
              setPage(1);
            }}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="rounded-lg bg-zinc-800 hover:bg-zinc-700 p-2 text-zinc-300 transition-colors self-end sm:self-auto"
          title="Yenile"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span>Toplam {total} kayıt</span>
        <span>Sayfa {page} / {totalPages}</span>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Tarih</th>
              <th className="py-3 px-4">Yönetici (Actor)</th>
              <th className="py-3 px-4">Eylem (Action)</th>
              <th className="py-3 px-4">Hedef Nesne</th>
              <th className="py-3 px-4 text-right">Detay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Günlükler yükleniyor...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-500">
                  Kayıtlı denetim günlüğü bulunamadı.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                    {new Date(l.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">{l.actorEmail}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] font-semibold bg-zinc-800 text-emerald-400 px-2 py-0.5 rounded border border-zinc-700">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[11px] font-mono text-zinc-400">
                    {l.entityType} {l.entityId ? `(#${l.entityId.slice(0, 8)})` : ""}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(l)}
                      className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors"
                    >
                      <Eye className="h-3 w-3" />
                      <span>İncele</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-400">
            Sayfa <span className="font-semibold text-white">{page}</span> / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Denetim Günlüğü Detayı</h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-1 font-mono">
                <p><span className="text-zinc-500 font-sans">Eylem:</span> {selectedLog.action}</p>
                <p><span className="text-zinc-500 font-sans">Yönetici:</span> {selectedLog.actorEmail}</p>
                <p><span className="text-zinc-500 font-sans">Tarih:</span> {new Date(selectedLog.createdAt).toLocaleString("tr-TR")}</p>
                <p><span className="text-zinc-500 font-sans">Hedef:</span> {selectedLog.entityType} ({selectedLog.entityId || "-"})</p>
              </div>

              <div>
                <p className="font-semibold text-zinc-300 mb-1">Payload Detayları (Redacted JSON):</p>
                <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 text-[11px] font-mono text-emerald-400 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 text-right">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
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
