"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, Info } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
  );
}
