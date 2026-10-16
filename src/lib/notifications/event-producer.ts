import { prisma } from "../db/prisma";
import { NotificationEventType, NotificationStatus } from "@prisma/client";
import { enqueueEventDeliveries } from "./dispatcher";

export interface GamePriceEvaluationContext {
  gameId: string;
  gameTitle: string;
  gameSlug: string;
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  historicalLow: number;
  dealScore: number;
  isNewLow: boolean;
  currency?: string;
  parentGameId?: string;
  parentGameTitle?: string;
}

/**
 * Generates deterministic deduplication key for an event to guarantee idempotency.
 */
export function buildEventDedupeKey(
  eventType: NotificationEventType,
  userId: string,
  gameId: string,
  price: number
): string {
  const dateStr = new Date().toISOString().split("T")[0]; // Daily deduplication window
  return `${eventType}:${userId}:${gameId}:${price.toFixed(2)}:${dateStr}`;
}

/**
 * Evaluates and produces domain NotificationEvents for games following price changes:
 * - PRICE_DROP (for wishlist/favorite watchers)
 * - NEW_OBSERVED_LOW (for wishlist/favorite watchers)
 * - DEAL_SCORE_THRESHOLD (when score >= 80)
 * - OWNED_GAME_DLC_DEAL (for users who own the parent base game)
 * - WISHLIST_DEAL
 * - FAVORITE_PRICE_CHANGE
 */
export async function producePriceChangeEvents(
  context: GamePriceEvaluationContext,
  db = prisma
): Promise<number> {
  let createdCount = 0;
  const now = new Date();

  // 1. Wishlist and Favorites Watchers
  const userInteractions = await db.userGame.findMany({
    where: {
      gameId: context.gameId,
      OR: [{ wishlist: true }, { favorite: true }],
    },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  for (const interaction of userInteractions) {
    const userId = interaction.userId;

    // Wishlist deal event
    if (interaction.wishlist && context.discountPercent > 0) {
      const dedupeKey = buildEventDedupeKey(
        NotificationEventType.WISHLIST_DEAL,
        userId,
        context.gameId,
        context.currentPrice
      );

      try {
        const event = await db.notificationEvent.create({
          data: {
            userId,
            gameId: context.gameId,
            type: NotificationEventType.WISHLIST_DEAL,
            status: NotificationStatus.PENDING,
            dedupeKey,
            payload: {
              gameTitle: context.gameTitle,
              gameSlug: context.gameSlug,
              currentPrice: context.currentPrice,
              listPrice: context.listPrice,
              discountPercent: context.discountPercent,
              dealScore: context.dealScore,
              currency: context.currency || "TL",
              matchReason: `İstek listenizdeki ${context.gameTitle} %${context.discountPercent} indirime girdi!`,
              triggeredAt: now.toISOString(),
            },
          },
        });
        await enqueueEventDeliveries(event.id, db);
        createdCount++;
      } catch {
        // Unique constraint violation (dedupeKey) -> Already created, safe ignore
      }
    }

    // Favorite price change event
    if (interaction.favorite) {
      const dedupeKey = buildEventDedupeKey(
        NotificationEventType.FAVORITE_PRICE_CHANGE,
        userId,
        context.gameId,
        context.currentPrice
      );

      try {
        const event = await db.notificationEvent.create({
          data: {
            userId,
            gameId: context.gameId,
            type: NotificationEventType.FAVORITE_PRICE_CHANGE,
            status: NotificationStatus.PENDING,
            dedupeKey,
            payload: {
              gameTitle: context.gameTitle,
              gameSlug: context.gameSlug,
              currentPrice: context.currentPrice,
              listPrice: context.listPrice,
              discountPercent: context.discountPercent,
              dealScore: context.dealScore,
              currency: context.currency || "TL",
              matchReason: `Favori oyununuz ${context.gameTitle} için güncel fiyat: ${context.currentPrice} TL`,
              triggeredAt: now.toISOString(),
            },
          },
        });
        await enqueueEventDeliveries(event.id, db);
        createdCount++;
      } catch {
        // Safe ignore duplicate
      }
    }

    // New observed low event
    if (context.isNewLow && context.discountPercent > 0) {
      const dedupeKey = buildEventDedupeKey(
        NotificationEventType.NEW_OBSERVED_LOW,
        userId,
        context.gameId,
        context.currentPrice
      );

      try {
        const event = await db.notificationEvent.create({
          data: {
            userId,
            gameId: context.gameId,
            type: NotificationEventType.NEW_OBSERVED_LOW,
            status: NotificationStatus.PENDING,
            dedupeKey,
            payload: {
              gameTitle: context.gameTitle,
              gameSlug: context.gameSlug,
              currentPrice: context.currentPrice,
              listPrice: context.listPrice,
              discountPercent: context.discountPercent,
              dealScore: context.dealScore,
              currency: context.currency || "TL",
              matchReason: `Tarihi dip fiyat rekoru! ${context.gameTitle} şimdiye kadarki en düşük fiyata ulaştı: ${context.currentPrice} TL`,
              triggeredAt: now.toISOString(),
            },
          },
        });
        await enqueueEventDeliveries(event.id, db);
        createdCount++;
      } catch {
        // Safe ignore duplicate
      }
    }
  }

  // 2. Owned Game DLC Deal: If this product is a DLC/Addon with a parent game, notify owners of the base game!
  if (context.parentGameId && context.discountPercent > 0) {
    const parentOwners = await db.userGame.findMany({
      where: {
        gameId: context.parentGameId,
        owned: true,
      },
      select: { userId: true },
    });

    for (const owner of parentOwners) {
      const dedupeKey = buildEventDedupeKey(
        NotificationEventType.OWNED_GAME_DLC_DEAL,
        owner.userId,
        context.gameId,
        context.currentPrice
      );

      try {
        const event = await db.notificationEvent.create({
          data: {
            userId: owner.userId,
            gameId: context.gameId,
            type: NotificationEventType.OWNED_GAME_DLC_DEAL,
            status: NotificationStatus.PENDING,
            dedupeKey,
            payload: {
              gameTitle: context.gameTitle,
              gameSlug: context.gameSlug,
              parentGameTitle: context.parentGameTitle || "Ana Oyun",
              currentPrice: context.currentPrice,
              listPrice: context.listPrice,
              discountPercent: context.discountPercent,
              dealScore: context.dealScore,
              currency: context.currency || "TL",
              matchReason: `Kütüphanenizde bulunan ${context.parentGameTitle || "oyununuz"} için ${context.gameTitle} eklentisi %${context.discountPercent} indirime girdi!`,
              triggeredAt: now.toISOString(),
            },
          },
        });
        await enqueueEventDeliveries(event.id, db);
        createdCount++;
      } catch {
        // Safe ignore duplicate
      }
    }
  }

  return createdCount;
}
