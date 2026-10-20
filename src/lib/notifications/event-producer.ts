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
 * Deterministic priority order for deciding primary event type when multiple triggers match.
 */
const EVENT_TYPE_PRIORITY: NotificationEventType[] = [
  NotificationEventType.FREE_GAME_DEAL,
  NotificationEventType.WISHLIST_DEAL,
  NotificationEventType.NEW_OBSERVED_LOW,
  NotificationEventType.HISTORICAL_LOW_MATCH,
  NotificationEventType.DEEP_DISCOUNT_DEAL,
  NotificationEventType.DEAL_SCORE_THRESHOLD,
  NotificationEventType.OWNED_GAME_DLC_DEAL,
  NotificationEventType.FAVORITE_PRICE_CHANGE,
  NotificationEventType.BUNDLE_DEAL,
  NotificationEventType.PRICE_DROP,
];

/**
 * Generates deterministic deduplication key for an event to guarantee idempotency.
 * Ensures a user receives AT MOST ONE notification per game per price drop event per day.
 */
export function buildEventDedupeKey(
  eventType: NotificationEventType,
  userId: string,
  gameId: string,
  price: number
): string {
  const dateStr = new Date().toISOString().split("T")[0]; // Daily deduplication window
  return `DEAL:${userId}:${gameId}:${price.toFixed(2)}:${dateStr}`;
}

/**
 * Evaluates and produces domain NotificationEvents for games following price changes.
 * Consolidates multiple matching categories (e.g. Tarihi Dip + Mega İndirim + Fırsat Skoru + İstek Listesi)
 * into a single unified notification per game per user, displaying distinctive category badges.
 */
export async function producePriceChangeEvents(
  context: GamePriceEvaluationContext,
  db = prisma
): Promise<number> {
  let createdCount = 0;
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  // 1. Catalog-level deal evaluation for this game
  const isFree =
    context.currentPrice === 0 &&
    (context.discountPercent === 100 || (context.listPrice && context.listPrice > 0));

  const isHistoricalLow =
    (context.historicalLow > 0 &&
      context.currentPrice <= context.historicalLow &&
      context.discountPercent > 0) ||
    context.isNewLow;

  const isDeepDiscount = context.discountPercent >= 70;
  const isHighScore = context.dealScore >= 80 && context.discountPercent > 0;
  const isBundle = context.productClass === "BUNDLE" && context.discountPercent > 0;

  const catalogBadges: string[] = [];
  const catalogTypes: NotificationEventType[] = [];

  if (isFree) {
    catalogTypes.push(NotificationEventType.FREE_GAME_DEAL);
    catalogBadges.push("🎁 Ücretsiz");
  }
  if (isHistoricalLow) {
    catalogTypes.push(NotificationEventType.HISTORICAL_LOW_MATCH);
    catalogBadges.push("🎯 Tarihi Dip");
  }
  if (isDeepDiscount) {
    catalogTypes.push(NotificationEventType.DEEP_DISCOUNT_DEAL);
    catalogBadges.push(`💥 Mega İndirim (%${context.discountPercent})`);
  }
  if (isHighScore) {
    catalogTypes.push(NotificationEventType.DEAL_SCORE_THRESHOLD);
    catalogBadges.push(`⚡ Fırsat Skoru (${context.dealScore})`);
  }
  if (isBundle) {
    catalogTypes.push(NotificationEventType.BUNDLE_DEAL);
    catalogBadges.push("📦 Paket İndirimi");
  }

  // 2. Fetch all active users, their watchlist/favorites for this game, and parent game ownership
  const [activeUsers, userInteractions, parentOwners] = await Promise.all([
    db.user.findMany({
      where: { accountStatus: "ACTIVE" },
      select: {
        id: true,
        notificationPreferences: {
          select: { eventType: true, channel: true, enabled: true },
        },
      },
    }),
    db.userGame.findMany({
      where: {
        gameId: context.gameId,
        OR: [{ wishlist: true }, { favorite: true }],
      },
      select: {
        userId: true,
        wishlist: true,
        favorite: true,
      },
    }),
    context.parentGameId && context.discountPercent > 0
      ? db.userGame.findMany({
          where: { gameId: context.parentGameId, owned: true },
          select: { userId: true },
        })
      : Promise.resolve([]),
  ]);

  const interactionMap = new Map(userInteractions.map((i) => [i.userId, i]));
  const parentOwnerSet = new Set(parentOwners.map((p) => p.userId));

  // 3. For each user, combine personal and catalog deal matches into ONE consolidated notification
  for (const user of activeUsers) {
    const userBadges = [...catalogBadges];
    const userTypes = [...catalogTypes];

    const userInt = interactionMap.get(user.id);
    if (userInt?.wishlist && context.discountPercent > 0) {
      userTypes.push(NotificationEventType.WISHLIST_DEAL);
      userBadges.unshift("✨ İstek Listesi");
    }
    if (userInt?.favorite) {
      userTypes.push(NotificationEventType.FAVORITE_PRICE_CHANGE);
      userBadges.push("❤️ Favori");
    }
    if (context.isNewLow && (userInt?.wishlist || userInt?.favorite)) {
      userTypes.push(NotificationEventType.NEW_OBSERVED_LOW);
    }
    if (context.parentGameId && parentOwnerSet.has(user.id) && context.discountPercent > 0) {
      userTypes.push(NotificationEventType.OWNED_GAME_DLC_DEAL);
      userBadges.push("📦 Sahip Olduğun Oyuna DLC");
    }

    // If game did not qualify for any deal category for this user, skip
    if (userTypes.length === 0) {
      continue;
    }

    // Check user preferences: is at least one channel enabled for any matching event type?
    const prefs = user.notificationPreferences;
    const hasEnabledChannel = userTypes.some((evtType) => {
      const typePrefs = prefs.filter((p) => p.eventType === evtType);
      if (typePrefs.length === 0) return true; // defaults to enabled
      return typePrefs.some((p) => p.enabled);
    });

    if (!hasEnabledChannel) {
      continue;
    }

    // Determine primary event type based on priority
    const primaryType =
      EVENT_TYPE_PRIORITY.find((t) => userTypes.includes(t)) || userTypes[0];

    // Deduplication key guarantees idempotency: maximum 1 notification per game per day
    const dedupeKey = `DEAL:${user.id}:${context.gameId}:${context.currentPrice.toFixed(2)}:${dateStr}`;

    const uniqueBadges = Array.from(new Set(userBadges));
    const matchReason = `${context.gameTitle} şu an ${context.currentPrice} ${
      context.currency || "TL"
    }.${context.discountPercent > 0 ? ` (%${context.discountPercent} indirim)` : ""}`;

    try {
      const event = await db.notificationEvent.create({
        data: {
          userId: user.id,
          gameId: context.gameId,
          type: primaryType,
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
            badges: uniqueBadges,
            matchingEventTypes: userTypes,
            matchReason,
            triggeredAt: now.toISOString(),
            parentGameTitle: context.parentGameTitle,
          },
        },
      });

      await enqueueEventDeliveries(event.id, db);
      createdCount++;
    } catch {
      // Unique constraint violation (dedupeKey) -> Already created, safe ignore
    }
  }

  return createdCount;
}
