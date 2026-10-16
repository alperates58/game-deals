import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { CatalogGameDetail } from "@/components/admin/catalog/catalog-game-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await prisma.game.findUnique({
    where: { id },
    select: { title: true },
  });

  return {
    title: game ? `${game.title} | Katalog Yönetimi | Admin` : "Oyun Bulunamadı | Admin",
  };
}

export default async function AdminGameDetailPage({ params }: Props) {
  await requireOwner();
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      priceHistories: {
        orderBy: { observedAt: "desc" },
        take: 50,
      },
      manualOverride: {
        include: {
          updatedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      ratings: true,
      subscriptions: true,
      languageSupports: true,
      mediaItems: {
        orderBy: { position: "asc" },
      },
      childRelations: {
        include: {
          childGame: {
            select: { id: true, title: true, productClass: true, imageUrl: true },
          },
        },
      },
      parentRelations: {
        include: {
          parentGame: {
            select: { id: true, title: true, productClass: true, imageUrl: true },
          },
        },
      },
      _count: {
        select: {
          userGames: true,
          priceAlerts: true,
        },
      },
    },
  });

  if (!game) {
    notFound();
  }

  const formattedGame = {
    id: game.id,
    title: game.title,
    slug: game.slug,
    productClass: game.productClass,
    developer: game.developer,
    publisher: game.publisher,
    releaseDate: game.releaseDate ? game.releaseDate.toISOString() : null,
    imageUrl: game.imageUrl,
    description: game.longDescription || game.shortDescription,
    isActive: game.isActive,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    prices: game.priceHistories.map((p) => ({
      id: p.id,
      originalPrice: Number(p.listPrice),
      currentPrice: Number(p.currentPrice),
      discountPercent: p.discountPercent,
      currency: p.currency,
      isFree: Number(p.currentPrice) === 0,
      isCurrent: false,
      recordedAt: p.observedAt.toISOString(),
      store: "XBOX",
    })),
    manualOverride: game.manualOverride
      ? {
          id: game.manualOverride.id,
          title: game.manualOverride.title,
          developer: game.manualOverride.developer,
          publisher: game.manualOverride.publisher,
          franchise: game.manualOverride.franchise,
          productClass: game.manualOverride.productClass,
          imageUrl: game.manualOverride.imageUrl,
          isActive: game.manualOverride.isActive,
          reason: game.manualOverride.reason,
          updatedAt: game.manualOverride.updatedAt.toISOString(),
          updatedByUser: game.manualOverride.updatedByUser,
        }
      : null,
    externalRatings: game.ratings.map((r) => ({
      id: r.id,
      provider: r.provider,
      criticScore: r.criticScore,
      userScore: r.userScore,
    })),
    subscriptions: game.subscriptions.map((s) => ({
      id: s.id,
      service: s.service,
      tier: s.tier,
      isActive: s.isActive,
    })),
    languageSupports: game.languageSupports.map((l) => ({
      id: l.id,
      languageCode: l.languageCode,
      audioSupported: l.audioSupported,
      subtitlesSupported: l.subtitlesSupported,
      interfaceSupported: l.interfaceSupported,
    })),
    media: game.mediaItems.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      caption: m.title,
    })),
    childRelationships: game.childRelations.map((r) => ({
      id: r.id,
      childGame: r.childGame,
    })),
    parentRelationships: game.parentRelations.map((r) => ({
      id: r.id,
      parentGame: r.parentGame,
    })),
    stats: {
      userGames: game._count.userGames,
      priceAlerts: game._count.priceAlerts,
    },
  };

  return <CatalogGameDetail game={formattedGame} />;
}
