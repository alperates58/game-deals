import { Metadata } from "next";
import Link from "next/link";
import { verifyAndConsumeEmailToken } from "@/lib/notifications/token-service";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "E-posta Doğrulama | Game Deals",
  description: "Game Deals hesap e-posta adresi doğrulama sayfası.",
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-950/60 border border-amber-800 text-amber-400 mb-6">
          <XCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Geçersiz Bağlantı</h1>
        <p className="text-sm text-zinc-400 mb-6">
          E-posta doğrulama belirteci bulunamadı. Lütfen e-postanıza gönderilen bağlantıyı kontrol ediniz.
        </p>
        <Link
          href="/ayarlar"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
        >
          Ayarlara Dön
        </Link>
      </div>
    );
  }

  const result = await verifyAndConsumeEmailToken(token);

  if (!result.success) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 mb-6">
          <XCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Doğrulama Başarısız</h1>
        <p className="text-sm text-zinc-400 mb-6">
          {result.error || "Doğrulama bağlantısı geçersiz veya süresi dolmuş."}
        </p>
        <Link
          href="/ayarlar"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-700 transition-colors"
        >
          Ayarlara Dön ve Yeni Bağlantı İste
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 mb-6">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white mb-2">E-posta Doğrulandı!</h1>
      <p className="text-sm text-zinc-400 mb-6">
        E-posta adresiniz başarıyla doğrulandı. Artık fiyat düşüşü, dip fiyat ve fırsat bildirimlerini e-posta ile alabilirsiniz.
      </p>
      <Link
        href="/ayarlar"
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950/40"
      >
        <span>Bildirim Tercihlerine Git</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
