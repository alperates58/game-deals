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
  productClass?: string;
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
 * Emits global catalog deal notifications to all active users who have not opted out of this event type.
 * Ensures users who don't explicitly watch or alarm the game still receive discovery alerts according to their notification preferences.
 */
async function notifyGlobalSubscribers(
  eventType: NotificationEventType,
  context: GamePriceEvaluationContext,
  matchReason: string,
  extraPayload: Record<string, any> = {},
  db = prisma
): Promise<number> {
  let count = 0;
  const now = new Date();

  // Find all active users and their preferences for this specific event type
  const activeUsers = await db.user.findMany({
    where: { accountStatus: "ACTIVE" },
    select: {
      id: true,
      notificationPreferences: {
        where: { eventType },
        select: { channel: true, enabled: true },
      },
    },
  });

  for (const user of activeUsers) {
    // Check if user explicitly disabled ALL channels for this eventType
    // If no preference is stored yet, system defaults to enabled.
    const prefs = user.notificationPreferences;
    const allDisabled = prefs.length > 0 && prefs.every((p) => !p.enabled);
    if (allDisabled) {
      continue;
    }

    const dedupeKey = buildEventDedupeKey(
      eventType,
      user.id,
      context.gameId,
      context.currentPrice
    );

    try {
      const event = await db.notificationEvent.create({
        data: {
          userId: user.id,
          gameId: context.gameId,
          type: eventType,
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
            matchReason,
            triggeredAt: now.toISOString(),
            ...extraPayload,
          },
        },
      });

      await enqueueEventDeliveries(event.id, db);
      count++;
    } catch {
      // Duplicate event (already notified today for this price) -> safe ignore
    }
  }

  return count;
}

/**
 * Evaluates and produces domain NotificationEvents for games following price changes:
 * - PRICE_DROP (for wishlist/favorite watchers)
 * - NEW_OBSERVED_LOW (for wishlist/favorite watchers)
 * - WISHLIST_DEAL
 * - FAVORITE_PRICE_CHANGE
 * - OWNED_GAME_DLC_DEAL (for users who own the parent base game)
 * - HISTORICAL_LOW_MATCH (Global Catalog Deal — no watch needed)
 * - FREE_GAME_DEAL (Global Catalog Deal — no watch needed)
 * - DEEP_DISCOUNT_DEAL (Global Catalog Deal — no watch needed)
 * - BUNDLE_DEAL (Global Catalog Deal — no watch needed)
 * - DEAL_SCORE_THRESHOLD (Global Catalog Deal — no watch needed)
 */
export async function producePriceChangeEvents(
  context: GamePriceEvaluationContext,
  db = prisma
): Promise<number> {
  let createdCount = 0;
  const now = new Date();

  // 1. Wishlist and Favorites Watchers (Personal Watch Lists)
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

    // New observed low event for explicitly watched game
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
              matchReason: `Tarihi dip fiyat rekoru! Takip ettiğiniz ${context.gameTitle} şimdiye kadarki en düşük fiyata ulaştı: ${context.currentPrice} TL`,
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

  // 3. Broad / Global Catalog Deals (NO WATCH / FOLLOW NEEDED):
  // Users who have enabled these preference categories receive notifications for any game across the catalog.

  // 3a. Free game (0 TL claimable) deal
  if (
    context.currentPrice === 0 &&
    (context.discountPercent === 100 || (context.listPrice && context.listPrice > 0))
  ) {
    createdCount += await notifyGlobalSubscribers(
      NotificationEventType.FREE_GAME_DEAL,
      context,
      `Tamamen ücretsiz! ${context.gameTitle} şu an 0 TL bedava olarak sunuluyor.`,
      { currentPrice: 0, discountPercent: 100 },
      db
    );
  }

  // 3b. Historical low match (Game price reached or matched historical low record)
  if (
    context.historicalLow > 0 &&
    context.currentPrice <= context.historicalLow &&
    context.discountPercent > 0
  ) {
    createdCount += await notifyGlobalSubscribers(
      NotificationEventType.HISTORICAL_LOW_MATCH,
      context,
      `Tarihi dip fiyata indi! ${context.gameTitle} en ucuz fiyatı olan ${context.currentPrice} TL seviyesine ulaştı.`,
      {},
      db
    );
  }

  // 3c. Deep discount (70% and above mega discounts)
  if (context.discountPercent >= 70) {
    createdCount += await notifyGlobalSubscribers(
      NotificationEventType.DEEP_DISCOUNT_DEAL,
      context,
      `Mega indirim fırsatı! ${context.gameTitle} %${context.discountPercent} indirimle ${context.currentPrice} TL oldu.`,
      {},
      db
    );
  }

  // 3d. Bundle / Collection deals
  if (context.productClass === "BUNDLE" && context.discountPercent > 0) {
    createdCount += await notifyGlobalSubscribers(
      NotificationEventType.BUNDLE_DEAL,
      context,
      `Koleksiyon paketi indirimi! ${context.gameTitle} paketi %${context.discountPercent} indirimde.`,
      {},
      db
    );
  }

  // 3e. Deal score threshold (>= 80 excellent deals)
  if (context.dealScore >= 80 && context.discountPercent > 0) {
    createdCount += await notifyGlobalSubscribers(
      NotificationEventType.DEAL_SCORE_THRESHOLD,
      context,
      `Kaçırılmayacak fırsat! ${context.gameTitle} yüksek fırsat skoru (${context.dealScore}/100) ile %${context.discountPercent} indirimde.`,
      {},
      db
    );
  }

  return createdCount;
}
