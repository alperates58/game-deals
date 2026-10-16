import { prisma } from "../db/prisma";
import { PriceAlertType, NotificationEventType, NotificationStatus } from "@prisma/client";

export interface AlertEvaluationContext {
  gameId: string;
  currentPrice: number;
  listPrice: number;
  discountPercent: number;
  historicalLow: number;
  dealScore: number;
  isNewLow: boolean;
}

/**
 * Evaluates active user price alerts for a game following price updates,
 * creating deduplicated NotificationEvent records in PENDING status.
 */
export async function evaluateGamePriceAlerts(
  context: AlertEvaluationContext
): Promise<{ evaluated: number; triggered: number }> {
  const alerts = await prisma.priceAlert.findMany({
    where: {
      gameId: context.gameId,
      isEnabled: true,
    },
    include: {
      game: {
        select: {
          id: true,
          title: true,
          slug: true,
          currency: true,
        },
      },
    },
  });

  let triggered = 0;
  const now = new Date();

  for (const alert of alerts) {
    let matched = false;
    let matchReason = "";

    switch (alert.type) {
      case PriceAlertType.ANY_DISCOUNT:
        if (context.discountPercent > 0) {
          matched = true;
          matchReason = `Oyun %${context.discountPercent} indirime girdi.`;
        }
        break;

      case PriceAlertType.PRICE_BELOW:
        if (alert.targetPrice && context.currentPrice <= alert.targetPrice.toNumber()) {
          matched = true;
          matchReason = `Fiyat hedefiniz olan ${alert.targetPrice} TL seviyesinin altına indi (${context.currentPrice} TL).`;
        }
        break;

      case PriceAlertType.DISCOUNT_AT_LEAST:
        if (alert.targetDiscount && context.discountPercent >= alert.targetDiscount) {
          matched = true;
          matchReason = `İndirim oranı hedefiniz olan %${alert.targetDiscount} seviyesine ulaştı (%${context.discountPercent}).`;
        }
        break;

      case PriceAlertType.OBSERVED_LOW:
        if (context.isNewLow && context.discountPercent > 0) {
          matched = true;
          matchReason = `Oyun takip tarihindeki en düşük dip fiyata ulaştı (${context.currentPrice} TL).`;
        }
        break;

      case PriceAlertType.DEAL_SCORE_AT_LEAST:
        if (alert.targetDealScore && context.dealScore >= alert.targetDealScore) {
          matched = true;
          matchReason = `Fırsat skoru hedefiniz olan ${alert.targetDealScore} seviyesine ulaştı (Puan: ${context.dealScore}/100).`;
        }
        break;
    }

    if (!matched) continue;

    // Deduplication check: Do not re-trigger if already triggered at this price within the last 24 hours
    if (alert.lastTriggeredAt) {
      const hoursSinceLast = (now.getTime() - alert.lastTriggeredAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 24) {
        continue;
      }
    }

    // Create NotificationEvent contract (Future Telegram/Email delivery pipeline)
    const dedupeKey = `ALERT_MATCHED:${alert.userId}:${alert.gameId}:${context.currentPrice.toFixed(2)}:${now.toISOString().split("T")[0]}`;
    try {
      const event = await prisma.notificationEvent.create({
        data: {
          userId: alert.userId,
          gameId: alert.gameId,
          type: NotificationEventType.ALERT_MATCHED,
          status: NotificationStatus.PENDING,
          dedupeKey,
          payload: {
            alertId: alert.id,
            alertType: alert.type,
            gameTitle: alert.game.title,
            gameSlug: alert.game.slug,
            currentPrice: context.currentPrice,
            listPrice: context.listPrice,
            discountPercent: context.discountPercent,
            dealScore: context.dealScore,
            currency: alert.game.currency,
            matchReason,
            triggeredAt: now.toISOString(),
          },
        },
      });

      // Enqueue channel deliveries idempotently
      const { enqueueEventDeliveries } = await import("../notifications/dispatcher");
      await enqueueEventDeliveries(event.id);
    } catch {
      // Safe ignore duplicate dedupeKey
    }

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: { lastTriggeredAt: now },
    });


    triggered++;
  }

  return { evaluated: alerts.length, triggered };
}
