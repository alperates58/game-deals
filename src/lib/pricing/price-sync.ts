import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { NormalizedXboxProduct } from "../xbox/types";
import { evaluateObservedLow } from "./observed-low";
import { calculateDealScore } from "./deal-score";

export interface SyncStats {
  checked: number;
  added: number;
  updated: number;
  pricesChanged: number;
  skippedFree: number;
  errors: number;
}

export async function processNormalizedProduct(
  product: NormalizedXboxProduct,
  franchise?: string,
  isCore = false,
  now: Date = new Date()
): Promise<{ added: boolean; priceChanged: boolean; skipped: boolean }> {
  // Exclude free games or zero price items per scope rules
  if (product.isFree || (product.currentPrice === 0 && product.listPrice === 0)) {
    return { added: false, priceChanged: false, skipped: true };
  }

  // Filter out non-games (e.g. Pass, Consumable)
  if (
    product.productType.toLowerCase().includes("pass") ||
    product.productType.toLowerCase().includes("consumable")
  ) {
    return { added: false, priceChanged: false, skipped: true };
  }

  const existing = await prisma.game.findUnique({
    where: { xboxProductId: product.productId },
    include: {
      priceHistories: {
        orderBy: { observedAt: "desc" },
        take: 30,
      },
    },
  });

  const currentPriceDecimal = new Prisma.Decimal(product.currentPrice);
  const listPriceDecimal = new Prisma.Decimal(product.listPrice);

  if (!existing) {
    // New game entry
    const lowResult = evaluateObservedLow(product.currentPrice, null, null, now);
    const lowDecimal = new Prisma.Decimal(lowResult.historicalLow);

    // Initial deal analysis
    const analysis = calculateDealScore({
      currentPrice: product.currentPrice,
      listPrice: product.listPrice,
      historicalLow: lowResult.historicalLow,
      firstSeenAt: now,
      priceHistoryCount: 1,
      saleHistoryCount: product.isOnSale ? 1 : 0,
    });

    // Make sure slug is unique
    let finalSlug = product.slug;
    const existingSlug = await prisma.game.findUnique({ where: { slug: finalSlug } });
    if (existingSlug) {
      finalSlug = `${product.slug}-${product.productId.toLowerCase().slice(0, 4)}`;
    }

    const created = await prisma.game.create({
      data: {
        xboxProductId: product.productId,
        slug: finalSlug,
        title: product.title,
        normalizedTitle: product.normalizedTitle,
        publisher: product.publisher,
        franchise: franchise || null,
        productType: product.productType,
        imageUrl: product.imageUrl,
        storeUrl: product.storeUrl,
        isCore,
        isActive: true,
        isFree: false,
        currentPrice: currentPriceDecimal,
        listPrice: listPriceDecimal,
        discountPercent: product.discountPercent,
        currency: product.currency,
        historicalLow: lowDecimal,
        historicalLowAt: lowResult.historicalLowAt,
        firstSeenAt: now,
        lastSeenAt: now,
        priceHistories: {
          create: {
            observedAt: now,
            currentPrice: currentPriceDecimal,
            listPrice: listPriceDecimal,
            discountPercent: product.discountPercent,
            currency: product.currency,
            isOnSale: product.isOnSale,
            saleEndAt: product.saleEndAt,
          },
        },
        dealAnalysis: {
          create: {
            dealScore: analysis.dealScore,
            confidenceScore: analysis.confidenceScore,
            historicalPosition: analysis.historicalPosition,
            saleFrequency: analysis.saleFrequency,
            daysSinceBetterPrice: analysis.daysSinceBetterPrice,
            verdict: analysis.verdict,
            reason: analysis.reason,
            calculatedAt: now,
          },
        },
      },
    });

    return { added: true, priceChanged: true, skipped: false };
  }

  // Existing game: Check if price changed
  const existingCurrent = existing.currentPrice.toNumber();
  const existingList = existing.listPrice.toNumber();
  const priceChanged =
    existingCurrent !== product.currentPrice || existingList !== product.listPrice;

  // Evaluate historical low
  const existingLow = existing.historicalLow.toNumber();
  const lowResult = evaluateObservedLow(
    product.currentPrice,
    existingLow,
    existing.historicalLowAt,
    now
  );
  const lowDecimal = new Prisma.Decimal(lowResult.historicalLow);

  // Recalculate Deal Analysis
  const historyCount = existing.priceHistories.length + (priceChanged ? 1 : 0);
  const saleCount =
    existing.priceHistories.filter((h) => h.isOnSale).length + (product.isOnSale ? 1 : 0);

  const analysis = calculateDealScore({
    currentPrice: product.currentPrice,
    listPrice: product.listPrice,
    historicalLow: lowResult.historicalLow,
    firstSeenAt: existing.firstSeenAt,
    priceHistoryCount: historyCount,
    saleHistoryCount: saleCount,
  });

  if (priceChanged) {
    // Insert new PriceHistory row ONLY when price changed
    await prisma.$transaction([
      prisma.priceHistory.create({
        data: {
          gameId: existing.id,
          observedAt: now,
          currentPrice: currentPriceDecimal,
          listPrice: listPriceDecimal,
          discountPercent: product.discountPercent,
          currency: product.currency,
          isOnSale: product.isOnSale,
          saleEndAt: product.saleEndAt,
        },
      }),
      prisma.game.update({
        where: { id: existing.id },
        data: {
          currentPrice: currentPriceDecimal,
          listPrice: listPriceDecimal,
          discountPercent: product.discountPercent,
          historicalLow: lowDecimal,
          historicalLowAt: lowResult.historicalLowAt,
          lastSeenAt: now,
          imageUrl: product.imageUrl || existing.imageUrl,
          isCore: isCore || existing.isCore,
          franchise: franchise || existing.franchise,
        },
      }),
      prisma.dealAnalysis.upsert({
        where: { gameId: existing.id },
        create: {
          gameId: existing.id,
          dealScore: analysis.dealScore,
          confidenceScore: analysis.confidenceScore,
          historicalPosition: analysis.historicalPosition,
          saleFrequency: analysis.saleFrequency,
          daysSinceBetterPrice: analysis.daysSinceBetterPrice,
          verdict: analysis.verdict,
          reason: analysis.reason,
          calculatedAt: now,
        },
        update: {
          dealScore: analysis.dealScore,
          confidenceScore: analysis.confidenceScore,
          historicalPosition: analysis.historicalPosition,
          saleFrequency: analysis.saleFrequency,
          daysSinceBetterPrice: analysis.daysSinceBetterPrice,
          verdict: analysis.verdict,
          reason: analysis.reason,
          calculatedAt: now,
        },
      }),
    ]);

    return { added: false, priceChanged: true, skipped: false };
  } else {
    // Price did NOT change: Idempotent update of lastSeenAt & DealAnalysis only
    await prisma.$transaction([
      prisma.game.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          imageUrl: product.imageUrl || existing.imageUrl,
        },
      }),
      prisma.dealAnalysis.upsert({
        where: { gameId: existing.id },
        create: {
          gameId: existing.id,
          dealScore: analysis.dealScore,
          confidenceScore: analysis.confidenceScore,
          historicalPosition: analysis.historicalPosition,
          saleFrequency: analysis.saleFrequency,
          daysSinceBetterPrice: analysis.daysSinceBetterPrice,
          verdict: analysis.verdict,
          reason: analysis.reason,
          calculatedAt: now,
        },
        update: {
          dealScore: analysis.dealScore,
          confidenceScore: analysis.confidenceScore,
          historicalPosition: analysis.historicalPosition,
          saleFrequency: analysis.saleFrequency,
          verdict: analysis.verdict,
          reason: analysis.reason,
          calculatedAt: now,
        },
      }),
    ]);

    return { added: false, priceChanged: false, skipped: false };
  }
}
