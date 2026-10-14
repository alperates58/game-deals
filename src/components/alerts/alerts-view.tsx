"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Trash2,
  Power,
  Clock,
  TrendingDown,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Gamepad2,
  Info,
} from "lucide-react";
import { PriceAlertType } from "@prisma/client";

export interface AlertItem {
  id: string;
  type: PriceAlertType;
  targetPrice: number | null;
  targetDiscount: number | null;
  targetDealScore: number | null;
  isEnabled: boolean;
  triggerCount?: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  game: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    currentPrice: number;
    listPrice: number;
    discountPercent: number;
    historicalLow: number | null;
    dealAnalysis: {
      dealScore: number;
      verdict: string;
    } | null;
  };
}

export interface NotificationItem {
  id: string;
  eventType: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
}

interface AlertsViewProps {
  initialAlerts: AlertItem[];
  recentEvents: NotificationItem[];
}

export function AlertsView({ initialAlerts, recentEvents }: AlertsViewProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const formatCondition = (alert: AlertItem): string => {
    switch (alert.type) {
      case "ANY_DISCOUNT":
        return "Herhangi bir indirim gerçekleştiğinde";
      case "PRICE_BELOW":
        return `Fiyat ₺${Number(alert.targetPrice).toFixed(2)} altına indiğinde`;
      case "DISCOUNT_AT_LEAST":
        return `İndirim oranı en az %${alert.targetDiscount} olduğunda`;
      case "OBSERVED_LOW":
        return "Görülen en düşük (tarihi dip) fiyata indiğinde";
      case "DEAL_SCORE_AT_LEAST":
        return `Fırsat skoru en az ${alert.targetDealScore}/100 olduğunda`;
      default:
        return "Fiyat değiştiğinde";
    }
  };

  const handleToggle = async (alertId: string, currentEnabled: boolean) => {
    setLoadingId(alertId);
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, isEnabled: !currentEnabled }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isEnabled: !currentEnabled } : a))
        );
      }
    } catch (e) {
      console.error("Toggle error:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm("Bu fiyat alarmını silmek istediğinize emin misiniz?")) return;
    setLoadingId(alertId);
    try {
      const res = await fetch(`/api/alerts?id=${alertId}`, { method: "DELETE" });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } catch (e) {
      console.error("Delete error:", e);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-10">
      {/* Active Alerts List */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-400" />
          Kurulu Fiyat Alarmları ({alerts.length})
        </h2>

        {alerts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <Bell className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-300 font-medium">Henüz aktif bir fiyat alarmınız bulunmuyor.</p>
            <p className="text-xs text-zinc-500 mt-1 mb-4">
              Oyun detay sayfalarında veya istek listenizde zil ikonuna tıklayarak alarm oluşturabilirsiniz.
            </p>
            <Link
              href="/firsatlar"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Fırsatları İncele
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => {
              const game = alert.game;
              const isDiscounted = game.discountPercent > 0;

              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-4 transition-all ${
                    alert.isEnabled
                      ? "border-zinc-800 bg-zinc-900/60"
                      : "border-zinc-800/40 bg-zinc-950/40 opacity-70"
                  }`}
                >
                  <div className="flex gap-3">
                    <Link
                      href={`/oyun/${game.slug}`}
                      className="relative h-18 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-950"
                    >
                      {game.imageUrl ? (
                        <Image src={game.imageUrl} alt={game.title} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-700">
                          <Gamepad2 className="h-6 w-6" />
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/oyun/${game.slug}`}
                          className="text-sm font-semibold text-white hover:text-emerald-400 line-clamp-1 transition-colors"
                        >
                          {game.title}
                        </Link>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            alert.isEnabled
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {alert.isEnabled ? "Aktif" : "Pasif"}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-bold text-white">₺{game.currentPrice.toFixed(2)}</span>
                        {isDiscounted && (
                          <span className="text-[10px] text-emerald-400 font-bold">
                            -%{game.discountPercent}
                          </span>
                        )}
                        {game.historicalLow !== null && (
                          <span className="text-[10px] text-zinc-500">
                            Dip: ₺{game.historicalLow.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 rounded-md bg-zinc-950/60 border border-zinc-800/80 px-2.5 py-1.5 text-xs text-amber-300/90 font-medium">
                        Koşul: {formatCondition(alert)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 text-[11px]">
                      {(alert.triggerCount || 0) > 0
                        ? `Tetiklenme: ${alert.triggerCount} kez (${new Date(
                            alert.lastTriggeredAt!
                          ).toLocaleDateString("tr-TR")})`
                        : "Henüz tetiklenmedi"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggle(alert.id, alert.isEnabled)}
                        disabled={loadingId === alert.id}
                        className="rounded p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        title={alert.isEnabled ? "Alarmı Duraklat" : "Alarmı Etkinleştir"}
                      >
                        <Power
                          className={`h-4 w-4 ${alert.isEnabled ? "text-emerald-400" : "text-zinc-500"}`}
                        />
                      </button>

                      <button
                        onClick={() => handleDelete(alert.id)}
                        disabled={loadingId === alert.id}
                        className="rounded p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Alarmı Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Truthful Notification Event Queue */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-4">
          <Info className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Bildirim Olay Kuyruğu & Durumu</h3>
        </div>

        <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 p-3.5 mb-4 text-xs text-blue-300">
          <p className="font-medium">Truthful UI Bilgilendirmesi:</p>
          <p className="text-blue-400/90 mt-0.5">
            Telegram veya e-posta ile harici bildirim gönderimi bu fazda (Faz 1.2) aktif değildir. Sistem, kurduğunuz
            alarmlar karşılandığında bildirim olaylarını veritabanında güvenle oluşturur ve &ldquo;PENDING&rdquo; durumunda
            saklar.
          </p>
        </div>

        {recentEvents.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">Kayıtlı bildirim olayı bulunmuyor.</p>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-white block">{evt.title}</span>
                  <span className="text-zinc-400 text-[11px]">{evt.message}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block rounded px-2 py-0.5 text-[10px] font-mono font-medium bg-amber-950 text-amber-400 border border-amber-800/60">
                    {evt.status}
                  </span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">
                    {new Date(evt.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
