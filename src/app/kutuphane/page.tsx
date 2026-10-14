import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { LibraryView, LibraryGameItem } from "@/components/library/library-view";
import { Gamepad2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Kütüphanem | Xbox Gerçek Fırsat Takip Sistemi",
  description: "Sahip olduğunuz Xbox oyunları, eklentileri ve paketleri.",
};

export default async function LibraryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/kutuphane");
  }

  const userGames = await prisma.userGame.findMany({
    where: {
      userId: user.userId,
      owned: true,
    },
    include: {
      game: {
        select: {
          id: true,
          xboxProductId: true,
          title: true,
          slug: true,
          imageUrl: true,
          productClass: true,
          currentPrice: true,
          listPrice: true,
          discountPercent: true,
          historicalLow: true,
          dealAnalysis: {
            select: {
              dealScore: true,
              verdict: true,
            },
          },
          childRelations: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedItems: LibraryGameItem[] = userGames.map((ug) => ({
    id: ug.id,
    gameId: ug.gameId,
    game: {
      id: ug.game.id,
      xboxProductId: ug.game.xboxProductId,
      title: ug.game.title,
      slug: ug.game.slug,
      imageUrl: ug.game.imageUrl,
      productClass: ug.game.productClass,
      currentPrice: Number(ug.game.currentPrice),
      listPrice: Number(ug.game.listPrice),
      discountPercent: ug.game.discountPercent,
      historicalLow: ug.game.historicalLow ? Number(ug.game.historicalLow) : null,
      dealAnalysis: ug.game.dealAnalysis,
      childRelations: ug.game.childRelations,
    },
    owned: ug.owned,
    favorite: ug.favorite,
    wishlist: ug.wishlist,
    liked: ug.liked,
    disliked: ug.disliked,
    completed: ug.completed,
    createdAt: ug.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Gamepad2 className="h-4 w-4" />
          <span>Kişisel Oyun Koleksiyonu</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Kütüphanem</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sahip olduğunuz {formattedItems.length} Xbox oyunu ve eklentisi.
        </p>
      </div>

      <LibraryView initialItems={formattedItems} />
    </div>
  );
}
