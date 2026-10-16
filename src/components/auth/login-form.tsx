"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { GoogleButton } from "./google-button";

interface LoginFormProps {
  googleConfigured?: boolean;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_access_denied: "Google ile giriş yetkilendirmesi iptal edildi.",
  invalid_state: "Giriş oturumu zaman aşımına uğradı veya doğrulanamadı. Lütfen tekrar deneyin.",
  email_not_verified:
    "Google hesabınızın e-posta adresi doğrulanmamış. Güvenlik nedeniyle yalnızca doğrulanmış hesaplar kabul edilir.",
  registration_disabled:
    "Kullanıcı kaydı şu anda sistem yöneticisi tarafından durdurulmuştur. Yalnızca mevcut hesap sahipleri giriş yapabilir.",
  account_suspended:
    "Hesabınız sistem yöneticisi tarafından askıya alınmıştır. Detaylar ve yeniden etkinleştirme için yöneticiyle iletişime geçiniz.",
  google_failed: "Google ile giriş yapılırken bir sunucu hatası oluştu. Lütfen tekrar deneyin.",
  google_not_configured: "Google ile giriş sistemi henüz yapılandırılmamıştır.",
};


export function LoginForm({ googleConfigured = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthErrorParam = searchParams.get("error");
  const oauthErrorMessage = oauthErrorParam ? OAUTH_ERROR_MESSAGES[oauthErrorParam] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(oauthErrorMessage);
  const [loading, setLoading] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Giriş başarısız oldu.");
        setLoading(false);
        return;
      }

      router.push("/profil");
      router.refresh();
    } catch {
      setError("Ağ bağlantısı hatası oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showForgotNotice && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 p-3.5 flex items-start gap-2.5 text-xs text-blue-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Şifre Sıfırlama Henüz Etkin Değil</span>
            <span>
              Bu fazda e-posta tabanlı şifre sıfırlama sistemi henüz aktif edilmemiştir. Şifrenizi unuttuysanız lütfen sistem yöneticisiyle iletişime geçiniz.
            </span>
          </div>
        </div>
      )}

      {/* Google OAuth Entry */}
      {googleConfigured && (
        <div>
          <GoogleButton configured={googleConfigured} label="Google ile Devam Et" returnTo="/profil" />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-zinc-900/90 px-3 text-zinc-500 font-semibold tracking-wider">veya</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            E-posta Adresi
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@alperates.com.tr"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Şifre
            </label>
            <button
              type="button"
              onClick={() => setShowForgotNotice(!showForgotNotice)}
              className="text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              Şifremi unuttum
            </button>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Giriş Yapılıyor...</span>
            </>
          ) : (
            <span>Giriş Yap</span>
          )}
        </button>

        <div className="pt-2 text-center text-xs text-zinc-400">
          Henüz hesabınız yok mu?{" "}
          <Link href="/register" className="text-emerald-400 font-semibold hover:underline">
            Kayıt Ol
          </Link>
        </div>
      </form>
    </div>
  );
}
