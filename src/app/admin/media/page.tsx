import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { MediaManagementClient, MediaGameItem, VideoMediaItem } from "@/components/admin/media/media-management-client";
import { Image as ImageIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Medya Galerisi & Varlıklar | Admin",
  description: "Ekran görüntüleri, fragmanlar ve afiş CDN durumu.",
};

export default async function AdminMediaPage() {
  await requireOwner();

  const [totalWithImage, totalMissingImage, totalVideoMedia, rawGames, rawMissing, rawVideoMedia] = await Promise.all([
    prisma.game.count({ where: { imageUrl: { not: null } } }),
    prisma.game.count({ where: { imageUrl: null } }),
    prisma.gameMedia.count(),
    prisma.game.findMany({
      where: { imageUrl: { not: null } },
      take: 60,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        productClass: true,
        publisher: true,
        currentPrice: true,
        discountPercent: true,
      },
    }),
    prisma.game.findMany({
      where: { imageUrl: null },
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        productClass: true,
        publisher: true,
      },
    }),
    prisma.gameMedia.findMany({
      take: 40,
      orderBy: { createdAt: "desc" },
      include: {
        game: {
          select: { id: true, title: true, slug: true },
        },
      },
    }),
  ]);

  const initialGames: MediaGameItem[] = rawGames.map((g) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    imageUrl: g.imageUrl,
    productClass: g.productClass,
    publisher: g.publisher,
    currentPrice: Number(g.currentPrice),
    discountPercent: g.discountPercent,
  }));

  const missingGames: MediaGameItem[] = rawMissing.map((g) => ({
    id: g.id,
    title: g.title,
    slug: g.slug,
    imageUrl: g.imageUrl,
    productClass: g.productClass,
    publisher: g.publisher,
  }));

  const videoMediaList: VideoMediaItem[] = rawVideoMedia.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    url: m.url,
    provider: m.provider,
    game: m.game,
  }));

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <ImageIcon className="h-4 w-4" />
          <span>Katalog Metadata</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Medya & Görsel Varlıklar</h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          Katalogdaki oyunlara ait resmi Xbox CDN afişleri, eksik görsel denetimi ve video fragmanlar.
        </p>
      </div>

      <MediaManagementClient
        initialGames={initialGames}
        missingGames={missingGames}
        videoMediaList={videoMediaList}
        stats={{
          totalWithImage,
          totalMissingImage,
          totalVideoMedia,
        }}
      />
    </div>
  );
}
