import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Sparkles, TrendingDown, Clock, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fırsat Zekası & Fiyat Analizi | Admin",
  description: "Fırsat skoru algoritması, tarihi dip dağılımı ve fiyat anomalileri.",
};

export default async function AdminDealIntelligencePage() {
  await requireOwner();

  const [totalDiscounted, totalFree, allActiveAlerts] = await Promise.all([
    prisma.game.count({
      where: { isActive: true, discountPercent: { gt: 0 } },
    }),
    prisma.game.count({
      where: { isActive: true, isFree: true },
    }),
    prisma.priceAlert.count({
      where: { isEnabled: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Fiyat Zeka</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Fırsat Zekası & Algoritma (Deal Intelligence)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Fırsat puanı hesaplama modeli, tarihi dip tespiti ve fiyat anomalisi kontrolleri.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 font-medium">Aktif İndirimli Oyun</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalDiscounted} adet</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 font-medium">Ücretsiz Ürünler</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{totalFree} adet</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 font-medium">Bekleyen Kullanıcı Alarmları</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{allActiveAlerts} aktif alarm</p>
        </div>
      </div>

      {/* Algorithm Specs */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Fırsat Skoru (Deal Score) Hesaplama Formülü</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800/80 space-y-2">
            <span className="font-semibold text-emerald-400 block text-sm">İndirim Oranı (%40)</span>
            <p className="text-zinc-400 leading-relaxed">
              Orijinal fiyata göre yüzdesel indirim oranı. %50 ve üzeri indirimler taban skoru doğrudan yukarı taşır.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800/80 space-y-2">
            <span className="font-semibold text-amber-400 block text-sm">Tarihi Dip Bonusu (%35)</span>
            <p className="text-zinc-400 leading-relaxed">
              Ürünün kayıt altına alınan tüm zamanlar en düşük fiyatına eşit veya altında olması durumunda ek 35 puan eklenir.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-950 p-4 border border-zinc-800/80 space-y-2">
            <span className="font-semibold text-blue-400 block text-sm">Popülerlik & Metacritic (%25)</span>
            <p className="text-zinc-400 leading-relaxed">
              Kullanıcıların istek/favori listelerindeki yoğunluğu ve varsa harici eleştirmen puanı ile normalize edilir.
            </p>
          </div>
        </div>
      </div>

      {/* Public links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/tarihi-dip"
          className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors text-xs text-zinc-300"
        >
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="font-semibold text-white">Canlı Tarihi Dip Fırsatları</span>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-500" />
        </Link>

        <Link
          href="/firsatlar"
          className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors text-xs text-zinc-300"
        >
          <div className="flex items-center gap-2.5">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-white">Canlı Tüm Fırsatlar Listesi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-500" />
        </Link>
      </div>
    </div>
  );
}
