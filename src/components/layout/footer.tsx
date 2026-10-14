import Link from "next/link";
import { ShieldCheck, Database, Info } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-zinc-800/80 bg-zinc-950 py-12 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-zinc-900">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                X
              </div>
              <span className="font-semibold text-white tracking-tight">
                game.alperates.com.tr
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Xbox ve Microsoft Store Türkiye pazarındaki popüler ücretli oyunların gerçek indirim geçmişini takip eden, yanıltıcı fiyat tuzaklarına karşı dürüst fiyat analiz motorudur.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Dürüst Veri İlkeleri (Truthful UI)
            </h4>
            <ul className="text-xs space-y-2 text-zinc-400">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>Asla sahte veya tahmin edilmiş dip fiyat gösterilmez.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>Yalnızca sistemin bizzat gözlemlediği gerçek veriler paylaşılır.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>Ücretsiz oyunlar ve eklentiler ana katalogdan filtrelenir.</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-3 flex items-center gap-1.5">
              <Database className="h-4 w-4 text-emerald-400" />
              Veri Kaynağı & Yasal Uyarı
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Fiyat verileri doğrudan halka açık Microsoft Display Catalog Türkiye mağazasından periyodik olarak toplanmaktadır. Microsoft Corporation veya Xbox ile resmi bir bağı bulunmamaktadır.
            </p>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <Link href="/api/health" className="hover:text-emerald-400 transition-colors">
                Sistem Durumu (Health)
              </Link>
              <span>•</span>
              <span>Para Birimi: TRY</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-4">
          <p>© {new Date().getFullYear()} game.alperates.com.tr — Tüm hakları saklıdır.</p>
          <p className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-zinc-400" />
            <span>Alper Design OS Greenfield Standardı ile Geliştirilmiştir.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
