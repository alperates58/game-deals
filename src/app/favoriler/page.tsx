import { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Heart, Sparkles, Gamepad2, ArrowRight } from "lucide-react";
import { GameActions } from "@/components/game/game-actions";

export const metadata: Metadata = {
  title: "Favorilerim | Xbox Gerçek Fırsat Takip Sistemi",
  description: "Favorilerinize eklediğiniz Xbox oyunları ve özel takip listeniz.",
};

export default async function FavoritesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/favoriler");
  }

  const favorites = await prisma.userGame.findMany({
    where: {
      userId: user.userId,
      favorite: true,
    },
    include: {
      game: {
        include: {
          dealAnalysis: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">
          <Heart className="h-4 w-4 fill-current" />
          <span>Özel Seçimleriniz</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Favorilerim</h1>
        <p className="mt-1 text-sm text-zinc-400">
          En çok beğendiğiniz ve hızlı erişmek istediğiniz {favorites.length} oyun.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-red-400 mb-4">
            <Heart className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Henüz Favori Oyununuz Yok</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-400 mb-6">
            Oyun detay sayfalarındaki kalp butonunu kullanarak favori oyunlarınızı buraya ekleyebilir ve hızlıca takip edebilirsiniz.
          </p>
          <Link
            href="/firsatlar"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Oyunları Keşfet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {favorites.map((fav) => {
            const game = fav.game;
            const currentPrice = Number(game.currentPrice);
            const listPrice = Number(game.listPrice);
            const isDiscounted = game.discountPercent > 0;

            return (
              <div
                key={fav.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-all shadow-sm"
              >
                <div className="flex gap-3">
                  <Link href={`/oyun/${game.slug}`} className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-950">
                    {game.imageUrl ? (
                      <Image
                        src={game.imageUrl}
                        alt={game.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-700">
                        <Gamepad2 className="h-6 w-6" />
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">{game.productClass}</span>
                    <Link
                      href={`/oyun/${game.slug}`}
                      className="text-sm font-semibold text-white hover:text-emerald-400 line-clamp-1 transition-colors block"
                    >
                      {game.title}
                    </Link>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm font-bold text-white">₺{currentPrice.toFixed(2)}</span>
                      {isDiscounted && (
                        <>
                          <span className="text-xs text-zinc-500 line-through">₺{listPrice.toFixed(2)}</span>
                          <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60">
                            -%{game.discountPercent}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-zinc-400">
                    {game.dealAnalysis && (
                      <span className="font-medium text-emerald-400">
                        Skor: {game.dealAnalysis.dealScore}/100
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/oyun/${game.slug}`}
                    className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-emerald-400 font-medium"
                  >
                    Detaylar
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
