"use client";

import { useState } from "react";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import type {
  TelegramWebhookInfoResult,
  SetWebhookResult,
} from "@/lib/notifications/telegram-webhook";

interface TelegramIntegrationCardProps {
  initialInfo: TelegramWebhookInfoResult;
}

export function TelegramIntegrationCard({ initialInfo }: TelegramIntegrationCardProps) {
  const [info, setInfo] = useState<TelegramWebhookInfoResult>(initialInfo);
  const [loadingAction, setLoadingAction] = useState<"sync" | "remove" | "refresh" | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const handleSyncWebhook = async () => {
    setLoadingAction("sync");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/integrations/telegram/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data: SetWebhookResult = await res.json();
      if (data.webhookInfo) {
        setInfo(data.webhookInfo);
      }
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          text: "Telegram Webhook başarıyla kaydedildi ve Telegram Bot API tarafından doğrulandı (ACTIVE).",
        });
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Webhook senkronizasyonu başarısız oldu.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Bağlantı hatası: ${err?.message || "İstek gönderilemedi"}`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemoveWebhook = async () => {
    const confirmed = window.confirm(
      "Telegram webhook kaydını silmek istediğinize emin misiniz? Webhook silindiğinde gelen mesajlar işlenemez."
    );
    if (!confirmed) return;

    setLoadingAction("remove");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/integrations/telegram/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      const data: SetWebhookResult = await res.json();
      if (data.webhookInfo) {
        setInfo(data.webhookInfo);
      }
      if (res.ok && data.success) {
        setFeedback({
          type: "info",
          text: "Telegram Webhook başarıyla kaldırıldı (NOT_REGISTERED).",
        });
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Webhook kaldırma işlemi başarısız oldu.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Bağlantı hatası: ${err?.message || "İstek gönderilemedi"}`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefreshStatus = async () => {
    setLoadingAction("refresh");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/integrations/telegram");
      const data: TelegramWebhookInfoResult = await res.json();
      if (res.ok) {
        setInfo(data);
        setFeedback({
          type: "info",
          text: "Telegram Bot API webhook bilgisi güncellendi.",
        });
      } else {
        setFeedback({
          type: "error",
          text: (data as any)?.error || "Durum sorgulanırken hata oluştu.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `Bağlantı hatası: ${err?.message || "Sorgu başarısız"}`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const getWebhookBadge = () => {
    switch (info.webhookStatus) {
      case "ACTIVE":
        return {
          label: "Webhook: ACTIVE",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        };
      case "NOT_REGISTERED":
        return {
          label: "Webhook: NOT_REGISTERED",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
        };
      case "MISMATCH":
        return {
          label: "Webhook: MISMATCH",
          color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
        };
      case "ERROR":
        return {
          label: "Webhook: ERROR",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: <XCircle className="h-3.5 w-3.5" />,
        };
      case "NOT_CONFIGURED":
      default:
        return {
          label: "Webhook: NOT_CONFIGURED",
          color: "bg-zinc-800 text-zinc-400 border-zinc-700",
          icon: <Radio className="h-3.5 w-3.5" />,
        };
    }
  };

  const webhookBadge = getWebhookBadge();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Telegram Bot & Webhook</h2>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                Self-Managed
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Telegram Bot API webhook kaydı, durum doğrulaması ve mesaj yönlendirmesi.
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border ${
              info.configured
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-zinc-800 text-zinc-400 border-zinc-700"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{info.configured ? "CONFIGURED" : "NOT_CONFIGURED"}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border ${webhookBadge.color}`}
          >
            {webhookBadge.icon}
            <span>{webhookBadge.label}</span>
          </span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center justify-between gap-2 border ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : feedback.type === "error"
              ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
              : "bg-zinc-800/80 border-zinc-700 text-zinc-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
            {feedback.type === "error" && <XCircle className="h-4 w-4 shrink-0 text-rose-400" />}
            {feedback.type === "info" && <RefreshCw className="h-4 w-4 shrink-0 text-sky-400" />}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-white text-xs px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800/80 space-y-2 font-mono">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-sans text-zinc-500 font-medium">Bot Hesabı:</span>
            <span className="text-white font-semibold">
              {info.botUsername ? `@${info.botUsername}` : "Tanımlanmamış"}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span className="font-sans text-zinc-500 font-medium">Canonical Webhook:</span>
            <span className="text-zinc-300 text-[11px] break-all">{info.canonicalUrl}</span>
          </div>

          <div className="flex flex-col gap-0.5 text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span className="font-sans text-zinc-500 font-medium">Telegram&apos;da Kayıtlı URL:</span>
            <span
              className={`text-[11px] break-all ${
                info.webhookUrl === info.canonicalUrl
                  ? "text-emerald-400 font-semibold"
                  : info.webhookUrl
                  ? "text-amber-400 font-semibold"
                  : "text-zinc-500 italic"
              }`}
            >
              {info.webhookUrl || "Telegram tarafında kayıtlı webhook yok"}
            </span>
          </div>
        </div>

        <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800/80 space-y-2 font-mono">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-sans text-zinc-500 font-medium">Bekleyen Güncellemeler:</span>
            <span
              className={`font-semibold ${
                info.pendingUpdateCount > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {info.pendingUpdateCount} adet
            </span>
          </div>

          <div className="flex flex-col gap-0.5 text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span className="font-sans text-zinc-500 font-medium">Son Telegram API Hatası:</span>
            {info.lastErrorMessage ? (
              <span className="text-rose-400 text-[11px]">
                {info.lastErrorMessage}{" "}
                {info.lastErrorDate && (
                  <span className="text-zinc-500">
                    ({new Date(info.lastErrorDate).toLocaleString("tr-TR")})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-zinc-500 text-[11px]">Hata kaydı yok (Temiz)</span>
            )}
          </div>

          {info.connectivity?.details && (
            <div className="flex flex-col gap-0.5 text-zinc-400 pt-1 border-t border-zinc-800/60">
              <span className="font-sans text-zinc-500 font-medium">Ağ / Egress Durumu:</span>
              <span
                className={`text-[11px] ${
                  info.connectivity.status === "OK" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                [{info.connectivity.status}] {info.connectivity.details}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {info.webhookStatus === "ACTIVE" ? (
            <button
              type="button"
              disabled={loadingAction !== null || !info.configured}
              onClick={handleSyncWebhook}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-100 transition-colors disabled:opacity-50"
            >
              {loadingAction === "sync" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>Webhook&apos;u Yeniden Kaydet</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={loadingAction !== null || !info.configured}
              onClick={handleSyncWebhook}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 shadow-sm shadow-emerald-950"
            >
              {loadingAction === "sync" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Webhook&apos;u Yapılandır</span>
            </button>
          )}

          {info.webhookUrl && (
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={handleRemoveWebhook}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-900/40 bg-rose-950/20 hover:bg-rose-900/40 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors disabled:opacity-50"
            >
              {loadingAction === "remove" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>Webhook&apos;u Kaldır</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={loadingAction !== null}
          onClick={handleRefreshStatus}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50 ml-auto"
        >
          {loadingAction === "refresh" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span>Durumu Yenile</span>
        </button>
      </div>
    </div>
  );
}
