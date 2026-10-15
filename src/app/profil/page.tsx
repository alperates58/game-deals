import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getPersonalRecommendations, getOwnedDlcOpportunities } from "@/lib/recommendations/recommendation-engine";
import { DealBadge } from "@/components/game/deal-badge";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";
import {
  Gamepad2,
  Heart,
  Bookmark,
  Bell,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Layers,
} from "lucide-react";

export const metadata = {
  title: "Profilim ve Kişisel Oyun Merkezi | Xbox Fırsat",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch metrics & items in parallel
  const [
    ownedCount,
    favoriteCount,
    wishlistCount,
    alertCount,
    recentOwned,
    recentFavorites,
    recentWishlist,
    activeAlerts,
    recommendations,
    dlcOpportunities,
  ] = await Promise.all([
    prisma.userGame.count({ where: { userId: user.userId, owned: true } }),
    prisma.userGame.count({ where: { userId: user.userId, favorite: true } }),
    prisma.userGame.count({ where: { userId: user.userId, wishlist: true } }),
    prisma.priceAlert.count({ where: { userId: user.userId, isEnabled: true } }),
    prisma.userGame.findMany({
      where: { userId: user.userId, owned: true },
      include: { game: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.userGame.findMany({
      where: { userId: user.userId, favorite: true },
      include: { game: { include: { dealAnalysis: true } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.userGame.findMany({
      where: { userId: user.userId, wishlist: true },
      include: { game: { include: { dealAnalysis: true } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.priceAlert.findMany({
      where: { userId: user.userId, isEnabled: true },
      include: { game: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    getPersonalRecommendations(user.userId, 4),
    getOwnedDlcOpportunities(user.userId),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Profile Info Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-2xl shadow-inner">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">{user.name}</h1>
              {user.role === "OWNER" && (
                <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Sistem Yöneticisi (OWNER)
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.role === "OWNER" && (
            <Link
              href="/ayarlar"
              className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              Yönetici Ayarları
            </Link>
          )}
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Çıkış Yap</span>
            </button>
          </form>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/kutuphane"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-emerald-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Kütüphanem</span>
            <Gamepad2 className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-white">{ownedCount}</span>
          <span className="text-[11px] text-zinc-500 block mt-1">Sahip olunan oyun</span>
        </Link>

        <Link
          href="/favoriler"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-rose-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Favoriler</span>
            <Heart className="h-5 w-5 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-white">{favoriteCount}</span>
          <span className="text-[11px] text-zinc-500 block mt-1">Beğenilen oyun</span>
        </Link>

        <Link
          href="/istek-listem"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-indigo-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">İstek Listesi</span>
            <Bookmark className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-white">{wishlistCount}</span>
          <span className="text-[11px] text-zinc-500 block mt-1">Takip edilen oyun</span>
        </Link>

        <Link
          href="/alarmlar"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-amber-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Fiyat Alarmları</span>
            <Bell className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-white">{alertCount}</span>
          <span className="text-[11px] text-zinc-500 block mt-1">Aktif alarm</span>
        </Link>
      </div>

      {/* Owned Game DLC Opportunities (Section 16) */}
      {dlcOpportunities.length > 0 && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-950/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-blue-400" />
              <div>
                <h3 className="text-base font-bold text-white">Sahip Olduğun Oyunlar İçin Eklenti Fırsatları</h3>
                <p className="text-xs text-zinc-400">Kütüphanendeki ana oyunlara ait indirimdeki resmi DLC ve sezon biletleri</p>
              </div>
            </div>
            <Link href="/eklentiler" className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold">
              <span>Tüm Eklentiler</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dlcOpportunities.slice(0, 4).map((item) => (
              <Link
                key={item.dlc.id}
                href={`/oyun/${item.dlc.slug}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 hover:border-blue-500/40 transition-colors group flex items-center gap-3"
              >
                <div className="relative h-14 w-11 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                  {item.dlc.imageUrl ? (
                    <Image src={getOptimizedImageUrl(item.dlc.imageUrl, "thumb")} alt={item.dlc.title} fill sizes="44px" className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[9px] text-zinc-600">Resim Yok</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-blue-300 block truncate">{item.parentGame.title}</span>
                  <h4 className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                    {item.dlc.title}
                  </h4>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xs font-bold text-white">{item.dlc.currentPrice} {item.dlc.currency}</span>
                    {item.dlc.discountPercent > 0 && (
                      <span className="text-[10px] text-emerald-400 font-semibold">-%{item.dlc.discountPercent}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Preview (Section 17, 18) */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white">Sana Özel Öneriler</h3>
                <p className="text-xs text-zinc-400">Oyun zevkine ve favorilerine göre deterministik olarak hesaplandı</p>
              </div>
            </div>
            <Link href="/sana-ozel" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
              <span>Tümünü İncele</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.map((rec) => (
              <Link
                key={rec.game.id}
                href={`/oyun/${rec.game.slug}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 hover:border-emerald-500/40 transition-colors flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      %{rec.personalMatchScore} Eşleşme
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-400">
                      Fırsat: {rec.game.dealScore}/100
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {rec.game.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {rec.explanation}
                  </p>
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-zinc-800/60">
                  <span className="text-xs font-bold text-white">
                    {rec.game.currentPrice.toLocaleString("tr-TR")} {rec.game.currency}
                  </span>
                  {rec.game.discountPercent > 0 && (
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      -%{rec.game.discountPercent}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Two Columns: Recent Wishlist & Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wishlist Box */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-indigo-400" />
              İstek Listeniz
            </h3>
            <Link href="/istek-listem" className="text-xs text-indigo-400 hover:underline">
              Tümünü Gör ({wishlistCount})
            </Link>
          </div>

          {recentWishlist.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">İstek listenizde henüz oyun bulunmuyor.</p>
          ) : (
            <div className="space-y-2.5">
              {recentWishlist.map((ug) => (
                <Link
                  key={ug.id}
                  href={`/oyun/${ug.game.slug}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 hover:border-zinc-700 transition-colors"
                >
                  <span className="text-xs font-semibold text-white truncate max-w-xs">{ug.game.title}</span>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="font-bold text-emerald-400">{ug.game.currentPrice.toNumber()} {ug.game.currency}</span>
                    {ug.game.discountPercent > 0 && (
                      <span className="rounded bg-emerald-950 border border-emerald-800/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                        -%{ug.game.discountPercent}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active Alerts Box */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" />
              Aktif Fiyat Alarmlarınız
            </h3>
            <Link href="/alarmlar" className="text-xs text-amber-400 hover:underline">
              Tümünü Yönet ({alertCount})
            </Link>
          </div>

          {activeAlerts.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Kurulmuş aktif bir fiyat alarmınız bulunmuyor.</p>
          ) : (
            <div className="space-y-2.5">
              {activeAlerts.map((al) => (
                <div
                  key={al.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3"
                >
                  <div className="min-w-0 pr-3">
                    <span className="text-xs font-semibold text-white truncate block">{al.game.title}</span>
                    <span className="text-[10px] text-zinc-400">
                      {al.type === "PRICE_BELOW" && `${al.targetPrice} TL altına düşünce`}
                      {al.type === "DISCOUNT_AT_LEAST" && `En az %${al.targetDiscount} indirimde`}
                      {al.type === "OBSERVED_LOW" && "Tarihi dip fiyata gelince"}
                      {al.type === "DEAL_SCORE_AT_LEAST" && `Fırsat skoru ${al.targetDealScore}+ olunca`}
                      {al.type === "ANY_DISCOUNT" && "İlk indirime girdiğinde"}
                    </span>
                  </div>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 shrink-0">
                    Aktif
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
