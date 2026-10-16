"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { GoogleButton } from "./google-button";

interface RegisterFormProps {
  googleConfigured?: boolean;
}

export function RegisterForm({ googleConfigured = false }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError("Girdiğiniz şifreler birbiriyle uyuşmuyor.");
      return;
    }

    if (password.length < 8) {
      setError("Şifreniz en az 8 karakter uzunluğunda olmalıdır.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, passwordConfirmation }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kayıt işlemi başarısız oldu.");
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

      {/* Google OAuth Option */}
      {googleConfigured && (
        <div>
          <GoogleButton
            configured={googleConfigured}
            label="Google ile Kayıt Ol / Devam Et"
            returnTo="/profil"
          />
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
            Adınız ve Soyadınız
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Alper Ateş"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

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
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Şifre
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>En az 8 karakter olmalıdır</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Şifre Tekrarı
          </label>
          <input
            type="password"
            required
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
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
              <span>Hesap Oluşturuluyor...</span>
            </>
          ) : (
            <span>Kayıt Ol ve Giriş Yap</span>
          )}
        </button>

        <div className="pt-2 text-center text-xs text-zinc-400">
          Zaten bir hesabınız var mı?{" "}
          <Link href="/login" className="text-emerald-400 font-semibold hover:underline">
            Giriş Yap
          </Link>
        </div>
      </form>
    </div>
  );
}
