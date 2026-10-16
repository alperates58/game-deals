"use client";

import { useState } from "react";
import {
  KeyRound,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Globe,
  Mail,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface AuthSettingsProps {
  initialAllowRegistration: boolean;
  googleConfig: {
    isConfigured: boolean;
    clientIdMasked: string | null;
    redirectUri: string;
  };
  stats: {
    totalUsers: number;
    passwordUsers: number;
    googleUsers: number;
    verifiedUsers: number;
    suspendedUsers: number;
  };
}

export function AuthSettingsClient({
  initialAllowRegistration,
  googleConfig,
  stats,
}: AuthSettingsProps) {
  const [allowRegistration, setAllowRegistration] = useState(initialAllowRegistration);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleToggleRegistration = async (newValue: boolean) => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowRegistration: newValue }),
      });
      if (!res.ok) {
        throw new Error("Ayar güncellenemedi");
      }
      setAllowRegistration(newValue);
      setMessage({
        text: `Kayıt olma durumu başarıyla ${newValue ? "AÇIK" : "KAPALI"} olarak güncellendi.`,
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message || "Bir hata oluştu", type: "error" });
    } finally {
      setIsSaving(false);
    }
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

      {/* Auth Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Toplam Kullanıcı</p>
          <p className="text-xl font-bold text-white mt-1">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Şifreli Giriş</p>
          <p className="text-xl font-bold text-white mt-1">{stats.passwordUsers}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Google OAuth</p>
          <p className="text-xl font-bold text-white mt-1">{stats.googleUsers}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Doğrulanmış E-posta</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{stats.verifiedUsers}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium text-zinc-400">Askıya Alınan</p>
          <p className="text-xl font-bold text-red-400 mt-1">{stats.suspendedUsers}</p>
        </div>
      </div>

      {/* Registration Policy Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              Yeni Kullanıcı Kaydı (Registration Policy)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Sisteme yeni kullanıcıların kendi kendine kayıt olup olamayacağını belirler. Kapalı olduğunda hem yerel kayıt hem de yeni Google hesapları reddedilir.
            </p>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleToggleRegistration(!allowRegistration)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              allowRegistration ? "bg-emerald-600" : "bg-zinc-700"
            } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                allowRegistration ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Mevcut Durum:</span>
          {allowRegistration ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" />
              Kayıtlar Açık (Public Registration)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
              <Lock className="h-3 w-3" />
              Kayıtlar Kapalı (Sadece Davet / Mevcut Kullanıcılar)
            </span>
          )}
        </div>
      </div>

      {/* Google OAuth Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-400" />
              Google OAuth 2.0 Entegrasyonu
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Google hesabı ile tek tıkla giriş ve otomatik e-posta doğrulama yapılandırması.
            </p>
          </div>

          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border ${
              googleConfig.isConfigured
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-zinc-800 text-zinc-400 border-zinc-700"
            }`}
          >
            {googleConfig.isConfigured ? "Yapılandırıldı (Aktif)" : "Yapılandırılmadı"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Client ID:</span>
            <span className="font-mono text-zinc-300">
              {googleConfig.clientIdMasked || "Belirtilmemiş (GOOGLE_CLIENT_ID eksik)"}
            </span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Redirect URI:</span>
            <span className="font-mono text-zinc-300 break-all">{googleConfig.redirectUri}</span>
          </div>
        </div>

        <div className="rounded-lg bg-zinc-950/60 p-3 border border-zinc-800/80 text-xs text-zinc-400">
          <p className="font-medium text-zinc-300 mb-1">Google Console Ayarı İpucu:</p>
          <p>
            Google Cloud Console &gt; Credentials ekranında Authorized redirect URI olarak yukarıdaki adresi tanımlayınız.
          </p>
        </div>
      </div>

      {/* Security Policies */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-400" />
          Güvenlik & Oturum İlkeleri
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="font-semibold text-zinc-300 block mb-1">Şifre Hashing</span>
            <span className="text-zinc-400">
              Standard bcrypt / PBKDF2 ile güvenli hashleme. Düz metin şifreler asla saklanmaz.
            </span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="font-semibold text-zinc-300 block mb-1">Askıya Alma İlkesi</span>
            <span className="text-zinc-400">
              Askıya alınan hesapların hem yerel hem Google OAuth oturumları anında sonlandırılır ve reddedilir.
            </span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="font-semibold text-zinc-300 block mb-1">OWNER Koruma Kuralı (INV-001)</span>
            <span className="text-zinc-400">
              Sistemdeki son OWNER silinemez, askıya alınamaz ve yetkisi düşürülemez.
            </span>
          </div>

          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80">
            <span className="font-semibold text-zinc-300 block mb-1">Doğrulama Token Hashing</span>
            <span className="text-zinc-400">
              E-posta ve Telegram bağlama tokenları veritabanında SHA-256 hash olarak saklanır; düz metin sızıntısı engellenmiştir.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
