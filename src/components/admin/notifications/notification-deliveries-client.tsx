"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  RotateCcw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";

interface Delivery {
  id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  lastErrorSummary: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  event: {
    id: string;
    type: string;
    gameId: string | null;
    dedupeKey: string;
    createdAt: string;
  };
}

export function NotificationDeliveriesClient() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (channelFilter !== "ALL") params.set("channel", channelFilter);

      const res = await fetch(`/api/admin/notifications/deliveries?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setDeliveries(data.deliveries || []);
        setTotalPages(data.pagination.totalPages || 1);
        setTotal(data.pagination.total || 0);
        setStatusCounts(data.statusCounts || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [page, statusFilter, channelFilter]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/notifications/deliveries/${id}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDeliveries();
      } else {
        const data = await res.json();
        alert(data.error || "Yeniden deneme başlatılamadı");
      }
    } catch (err: any) {
      alert(err.message || "Bağlantı hatası");
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: NotificationDeliveryStatus) => {
    switch (status) {
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            İletildi
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            Bekliyor
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            İşleniyor
          </span>
        );
      case "RETRYING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            <RotateCcw className="h-3 w-3" />
            Tekrar Deneniyor
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/20">
            <XCircle className="h-3 w-3" />
            Başarısız
          </span>
        );
    }
  };

  const getChannelBadge = (ch: NotificationChannel) => {
    switch (ch) {
      case "EMAIL":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400">
            <Mail className="h-3 w-3" /> E-posta
          </span>
        );
      case "TELEGRAM":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400">
            <Send className="h-3 w-3" /> Telegram
          </span>
        );
      case "IN_APP":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <Bell className="h-3 w-3" /> In-App
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with back link & refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/notifications"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Sağlayıcılara Dön</span>
          </Link>
          <span className="text-zinc-600">|</span>
          <span className="text-xs text-zinc-400 font-medium">Toplam {total} Teslimat Kaydı</span>
        </div>

        <button
          type="button"
          onClick={fetchDeliveries}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
          <Filter className="h-3.5 w-3.5" />
          <span>Filtreler:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">Tüm Durumlar</option>
          <option value="PENDING">Bekliyor ({statusCounts.PENDING || 0})</option>
          <option value="PROCESSING">İşleniyor ({statusCounts.PROCESSING || 0})</option>
          <option value="SENT">İletildi ({statusCounts.SENT || 0})</option>
          <option value="RETRYING">Tekrar Deneniyor ({statusCounts.RETRYING || 0})</option>
          <option value="FAILED">Başarısız ({statusCounts.FAILED || 0})</option>
        </select>

        <select
          value={channelFilter}
          onChange={(e) => {
            setChannelFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">Tüm Kanallar</option>
          <option value="EMAIL">E-posta</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="IN_APP">In-App (Site İçi)</option>
        </select>
      </div>

      {/* Deliveries Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Tarih</th>
              <th className="py-3 px-4">Kullanıcı</th>
              <th className="py-3 px-4">Kanal</th>
              <th className="py-3 px-4">Olay Tipi</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4">Deneme</th>
              <th className="py-3 px-4">Son Hata</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Kayıtlar yükleniyor...
                </td>
              </tr>
            ) : deliveries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-500">
                  Filtreye uygun bildirim teslimat kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                    {new Date(d.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{d.user.name}</p>
                    <p className="text-[10px] text-zinc-400">{d.user.email}</p>
                  </td>
                  <td className="py-3 px-4">{getChannelBadge(d.channel)}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      {d.event.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(d.status)}</td>
                  <td className="py-3 px-4 font-mono text-zinc-400">
                    {d.attemptCount} / {d.maxAttempts}
                  </td>
                  <td className="py-3 px-4 max-w-[200px] truncate text-red-400/90 font-mono text-[11px]">
                    {d.lastErrorSummary || "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDelivery(d)}
                        className="rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors"
                      >
                        Detay
                      </button>
                      {(d.status === "FAILED" || d.status === "RETRYING") && (
                        <button
                          type="button"
                          disabled={retryingId === d.id}
                          onClick={() => handleRetry(d.id)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-950 border border-emerald-700/60 hover:bg-emerald-900 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors disabled:opacity-50"
                        >
                          {retryingId === d.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          <span>Dene</span>
                        </button>
                      )}
                    </div>
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

      {/* Inspector Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Teslimat Kaydı Detayı</h3>
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-1 font-mono">
                <p className="text-zinc-400">
                  <span className="text-zinc-500 font-sans">ID:</span> {selectedDelivery.id}
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500 font-sans">Kullanıcı:</span> {selectedDelivery.user.name} ({selectedDelivery.user.email})
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500 font-sans">Kanal:</span> {selectedDelivery.channel}
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500 font-sans">Olay ID:</span> {selectedDelivery.event.id}
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500 font-sans">Dedupe Key:</span> {selectedDelivery.event.dedupeKey}
                </p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500 font-sans">Denemeler:</span> {selectedDelivery.attemptCount} / {selectedDelivery.maxAttempts}
                </p>
                {selectedDelivery.nextAttemptAt && (
                  <p className="text-zinc-400">
                    <span className="text-zinc-500 font-sans">Sonraki Deneme:</span> {new Date(selectedDelivery.nextAttemptAt).toLocaleString("tr-TR")}
                  </p>
                )}
                {selectedDelivery.sentAt && (
                  <p className="text-emerald-400">
                    <span className="text-zinc-500 font-sans">Gönderim Zamanı:</span> {new Date(selectedDelivery.sentAt).toLocaleString("tr-TR")}
                  </p>
                )}
              </div>

              {selectedDelivery.lastErrorSummary && (
                <div className="rounded-lg bg-red-950/40 border border-red-500/30 p-3 text-red-300">
                  <p className="font-semibold mb-1 text-red-200">Hata Detayı:</p>
                  <p className="font-mono text-[11px] whitespace-pre-wrap">{selectedDelivery.lastErrorSummary}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
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
