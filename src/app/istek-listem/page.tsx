import { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Bookmark, Sparkles, Gamepad2, ArrowRight, TrendingDown, Bell, Clock } from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/xbox/image-utils";

export const metadata: Metadata = {
  title: "İstek Listem | Xbox Gerçek Fırsat Takip Sistemi",
  description: "Satın almayı planladığınız Xbox oyunları ve fiyat fırsatları.",
};

export default async function WishlistPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/istek-listem");
  }

  const wishlist = await prisma.userGame.findMany({
    where: {
      userId: user.userId,
      wishlist: true,
    },
    include: {
      game: {
        include: {
          dealAnalysis: true,
          priceAlerts: {
            where: { userId: user.userId },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalValue = wishlist.reduce((acc, item) => acc + Number(item.game.currentPrice), 0);
  const onSaleCount = wishlist.filter((item) => item.game.discountPercent > 0).length;
  const historicalLowCount = wishlist.filter(
    (item) => item.game.historicalLow && Number(item.game.currentPrice) <= Number(item.game.historicalLow)
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-zinc-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
            <Bookmark className="h-4 w-4 fill-current" />
            <span>Fırsat Bekleyen Oyunlar</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">İstek Listem</h1>
          <p className="mt-1 text-sm text-zinc-400">
            İndirim beklediğiniz {wishlist.length} Xbox oyunu.
          </p>
        </div>

        {wishlist.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-right">
              <span className="text-[11px] text-zinc-400 block">Toplam Liste Değeri</span>
              <span className="text-base font-bold text-white">₺{totalValue.toFixed(2)}</span>
            </div>
            <div className="rounded-lg bg-emerald-950/50 border border-emerald-800/60 px-3.5 py-2 text-right">
              <span className="text-[11px] text-emerald-400 block">Şu An İndirimde</span>
              <span className="text-base font-bold text-emerald-300">{onSaleCount} Oyun</span>
            </div>
          </div>
        )}
      </div>

      {wishlist.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-amber-400 mb-4">
            <Bookmark className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">İstek Listeniz Boş</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-400 mb-6">
            Satın almayı planladığınız oyunları istek listenize ekleyin, fiyatları düştüğünde anında haberdar olun.
          </p>
          <Link
            href="/firsatlar"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Fırsatları Keşfet
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {wishlist.map((item) => {
            const game = item.game;
            const currentPrice = Number(game.currentPrice);
            const listPrice = Number(game.listPrice);
            const historicalLow = game.historicalLow ? Number(game.historicalLow) : null;
            const isDiscounted = game.discountPercent > 0;
            const isAtLow = historicalLow !== null && currentPrice <= historicalLow;
            const hasAlert = game.priceAlerts && game.priceAlerts.length > 0;

            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-all shadow-sm"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Link href={`/oyun/${game.slug}`} className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-950">
                    {game.imageUrl ? (
                      <Image
                        src={getOptimizedImageUrl(game.imageUrl, "thumb")}
                        alt={game.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-700">
                        <Gamepad2 className="h-6 w-6" />
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">{game.productClass}</span>
                      {isAtLow && (
                        <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-800">
                          TARİHİ DİP
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/oyun/${game.slug}`}
                      className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors line-clamp-1 block"
                    >
                      {game.title}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      {historicalLow !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          Görülen En Düşük: ₺{historicalLow.toFixed(2)}
                        </span>
                      )}
                      {game.dealAnalysis && (
                        <span>
                          Fırsat Skoru: <span className="text-emerald-400 font-bold">{game.dealAnalysis.dealScore}/100</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-zinc-800/80 pt-3 sm:pt-0">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">₺{currentPrice.toFixed(2)}</span>
                      {isDiscounted && (
                        <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800">
                          -%{game.discountPercent}
                        </span>
                      )}
                    </div>
                    {isDiscounted && (
                      <span className="text-xs text-zinc-500 line-through block">₺{listPrice.toFixed(2)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/oyun/${game.slug}`}
                      className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                    >
                      {hasAlert ? (
                        <>
                          <Bell className="h-3.5 w-3.5 text-amber-400 fill-current" />
                          Alarm Kurulu
                        </>
                      ) : (
                        <>
                          <Bell className="h-3.5 w-3.5 text-zinc-400" />
                          Alarm Kur
                        </>
                      )}
                    </Link>

                    <Link
                      href={`/oyun/${game.slug}`}
                      className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors flex items-center gap-1"
                    >
                      İncele
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
