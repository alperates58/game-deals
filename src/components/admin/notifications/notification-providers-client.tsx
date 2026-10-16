"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Send,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

interface ProviderProps {
  email: {
    isConfigured: boolean;
    host: string;
    port: number;
    userMasked: string;
    fromAddress: string;
  };
  telegram: {
    isConfigured: boolean;
    botUsername: string;
    webhookUrl: string;
    activeSubscribers: number;
  };
  stats: {
    totalDeliveries: number;
    pendingDeliveries: number;
    sentDeliveries: number;
    failedDeliveries: number;
    totalInApp: number;
  };
}

export function NotificationProvidersClient({
  email,
  telegram,
  stats,
}: ProviderProps) {
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; success: boolean } | null>(null);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/notifications/email/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ text: "Test e-postası başarıyla gönderildi!", success: true });
      } else {
        setTestResult({ text: data.error || "E-posta gönderimi başarısız", success: false });
      }
    } catch (err: any) {
      setTestResult({ text: err.message || "Bağlantı hatası", success: false });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/notifications/telegram/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ text: "Test Telegram mesajı başarıyla iletildi!", success: true });
      } else {
        setTestResult({ text: data.error || "Telegram gönderimi başarısız", success: false });
      }
    } catch (err: any) {
      setTestResult({ text: err.message || "Bağlantı hatası", success: false });
    } finally {
      setTestingTelegram(false);
    }
  };

  return (
    <div className="space-y-6">
      {testResult && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center gap-2 border ${
            testResult.success
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{testResult.text}</span>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Toplam Teslimat</p>
          <p className="text-xl font-bold text-white mt-1">{stats.totalDeliveries}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Kuyrukta (Pending)</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{stats.pendingDeliveries}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Başarılı (Sent)</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{stats.sentDeliveries}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Hatalı (Failed)</p>
          <p className="text-xl font-bold text-red-400 mt-1">{stats.failedDeliveries}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">In-App Bildirim</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{stats.totalInApp}</p>
        </div>
      </div>

      {/* Delivery Queue Banner Link */}
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Teslimat Kuyruğu (Notification Delivery Queue)</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Arka plan işçi döngüsü (worker-loop) tarafından periyodik işlenen bildirim kuyruğu.
          </p>
        </div>
        <Link
          href="/admin/notifications/deliveries"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          <span>Kuyruğu İncele</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Channel Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Email Provider Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">SMTP E-posta Sağlayıcısı</h3>
                <p className="text-xs text-zinc-400">Nodemailer SMTP protokolü</p>
              </div>
            </div>

            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                email.isConfigured
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {email.isConfigured ? "Yapılandırıldı" : "Eksik Ayar"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Sunucu:</span>
              <span className="text-zinc-300">{email.host}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Port:</span>
              <span className="text-zinc-300">{email.port}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Kullanıcı:</span>
              <span className="text-zinc-300">{email.userMasked || "-"}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Kimden (From):</span>
              <span className="text-zinc-300 truncate max-w-[200px]">{email.fromAddress}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={!email.isConfigured || testingEmail}
              onClick={handleTestEmail}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors disabled:opacity-50"
            >
              {testingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Test E-postası Gönder</span>
            </button>
          </div>
        </div>

        {/* Telegram Bot Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Telegram Bot API</h3>
                <p className="text-xs text-zinc-400">Anlık fırsat ve alarm mesaj botu</p>
              </div>
            </div>

            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                telegram.isConfigured
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {telegram.isConfigured ? "Yapılandırıldı" : "Eksik Token"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Bot Kullanıcı Adı:</span>
              <span className="text-zinc-300">{telegram.botUsername}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Aktif Bağlantı:</span>
              <span className="text-emerald-400 font-sans font-semibold">
                {telegram.activeSubscribers} kullanıcı bağlı
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span className="text-zinc-500 font-sans">Webhook URI:</span>
              <span className="text-zinc-300 truncate max-w-[200px]">{telegram.webhookUrl}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={!telegram.isConfigured || testingTelegram}
              onClick={handleTestTelegram}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors disabled:opacity-50"
            >
              {testingTelegram ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Test Telegram Mesajı Gönder</span>
            </button>
          </div>
        </div>

        {/* In-App Notification Center Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Site İçi Bildirim Kutusu (In-App)</h3>
                <p className="text-xs text-zinc-400">Doğrudan veritabanı destekli kullanıcı gelen kutusu</p>
              </div>
            </div>

            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Aktif (Yerel)
            </span>
          </div>

          <div className="space-y-1.5 text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
            <div className="flex justify-between text-zinc-400">
              <span>Saklanan Bildirim:</span>
              <span className="font-semibold text-white font-mono">{stats.totalInApp} adet</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Gelen Kutusu Sayfası:</span>
              <span className="font-mono text-zinc-300">/bildirimler</span>
            </div>
          </div>
        </div>

        {/* Discord / Push Placeholders (Truthful UI) */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 space-y-4 opacity-75">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-300">Discord & Web Push (VAPID)</h3>
                <p className="text-xs text-zinc-500">Gelecek faz bildirim kanalları</p>
              </div>
            </div>

            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border bg-zinc-800 text-zinc-400 border-zinc-700">
              NOT_CONFIGURED
            </span>
          </div>

          <div className="text-xs text-zinc-400 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
            <p>
              Bu kanallar ALPER DESIGN OS Truthful UI prensibi gereği boş / mock veri göstermez. Faz 2 kapsamında Discord Webhook ve Web Push (VAPID) entegrasyonu sunulacaktır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
