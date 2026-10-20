import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { NormalizedXboxProduct } from "../xbox/types";
import { evaluateObservedLow } from "./observed-low";
import { calculateDealScore } from "./deal-score";
import { evaluateGamePriceAlerts } from "../alerts/alert-evaluator";

export interface SyncStats {
  checked: number;
  added: number;
  updated: number;
  pricesChanged: number;
  skippedFree: number;
  errors: number;
}

export interface ProcessProductOptions {
  franchise?: string;
  isCore?: boolean;
  discoverySource?: "FULL_CATALOG" | "RELATED" | "MANUAL" | "BUNDLE_CHILD";
  platforms?: string[];
  isSeriesXCompatible?: boolean;
  now?: Date;
}

export async function processNormalizedProduct(
  product: NormalizedXboxProduct,
  franchiseOrOptions?: string | ProcessProductOptions,
  isCore = false,
  now: Date = new Date()
): Promise<{ added: boolean; priceChanged: boolean; skipped: boolean }> {
  const options: ProcessProductOptions =
    typeof franchiseOrOptions === "object" && franchiseOrOptions !== null
      ? franchiseOrOptions
      : { franchise: franchiseOrOptions, isCore, now };

  const effectiveFranchise = options.franchise;
  const effectiveIsCore = options.isCore ?? isCore;
  const effectiveNow = options.now ?? now;
  const effectivePlatforms = options.platforms || product.platforms || [];
  const effectiveSeriesX =
    options.isSeriesXCompatible ?? (effectivePlatforms.includes("XboxSeriesX") || effectivePlatforms.length === 0);
  const effectiveSource =
    options.discoverySource === "BUNDLE_CHILD"
      ? "RELATED"
      : options.discoverySource || "FULL_CATALOG";
  // Exclude free games or zero price items per scope rules, EXCEPT for bundles and package contents
  const isBundleOrPackageItem =
    product.productClass === "BUNDLE" ||
    options.discoverySource === "BUNDLE_CHILD" ||
    Boolean((options as any).allowFree) ||
    product.productClass === "DLC" ||
    product.productClass === "EXPANSION" ||
    product.productClass === "ADD_ON" ||
    product.productClass === "SEASON_PASS" ||
    product.productClass === "CONTENT_PACK" ||
    (product.bundledProductIds && product.bundledProductIds.length > 0);

  if ((product.isFree || (product.currentPrice === 0 && product.listPrice === 0)) && !isBundleOrPackageItem) {
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
        franchise: effectiveFranchise || null,
        productType: product.productType,
        productClass: product.productClass,
        developer: product.developer,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        releaseDate: product.releaseDate,
        genres: product.genres,
        capabilities: product.capabilities,
        screenshots: product.screenshots,
        imageUrl: product.imageUrl,
        storeUrl: product.storeUrl,
        isCore: effectiveIsCore,
        isActive: true,
        isFree: Boolean(product.isFree || (product.currentPrice === 0 && product.listPrice === 0)),
        platforms: effectivePlatforms,
        isSeriesXCompatible: effectiveSeriesX,
        discoverySource: effectiveSource,
        currentPrice: currentPriceDecimal,
        listPrice: listPriceDecimal,
        discountPercent: product.discountPercent,
        currency: product.currency,
        historicalLow: lowDecimal,
        historicalLowAt: lowResult.historicalLowAt,
        firstSeenAt: effectiveNow,
        lastSeenAt: effectiveNow,
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

    return { added: true, priceChanged: false, skipped: false };
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
          lastSeenAt: effectiveNow,
          productClass: product.productClass,
          imageUrl: product.imageUrl || existing.imageUrl,
          isCore: effectiveIsCore || existing.isCore,
          franchise: effectiveFranchise || existing.franchise,
          platforms: effectivePlatforms.length > 0 ? effectivePlatforms : existing.platforms,
          isSeriesXCompatible: effectiveSeriesX,
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
          calculatedAt: effectiveNow,
        },
        update: {
          dealScore: analysis.dealScore,
          confidenceScore: analysis.confidenceScore,
          historicalPosition: analysis.historicalPosition,
          saleFrequency: analysis.saleFrequency,
          daysSinceBetterPrice: analysis.daysSinceBetterPrice,
          verdict: analysis.verdict,
          reason: analysis.reason,
          calculatedAt: effectiveNow,
        },
      }),
    ]);

    // Trigger NotificationEvents ONLY for canonical games (variants are unified to canonical)
    const isVariant = Boolean(existing.isPlatformVariant && existing.canonicalGameId);

    if (!isVariant) {
      // Trigger NotificationEvents for matching price alerts
      await evaluateGamePriceAlerts({
        gameId: existing.id,
        currentPrice: product.currentPrice,
        listPrice: product.listPrice,
        discountPercent: product.discountPercent,
        historicalLow: lowResult.historicalLow,
        dealScore: analysis.dealScore,
        isNewLow: lowResult.isNewLow,
      });

      // Trigger domain NotificationEvents for wishlist/favorites/deals
      try {
        const { producePriceChangeEvents } = await import("../notifications/event-producer");
        await producePriceChangeEvents({
          gameId: existing.id,
          gameTitle: existing.title,
          gameSlug: existing.slug,
          currentPrice: product.currentPrice,
          listPrice: product.listPrice,
          discountPercent: product.discountPercent,
          historicalLow: lowResult.historicalLow,
          dealScore: analysis.dealScore,
          isNewLow: lowResult.isNewLow,
          currency: existing.currency,
        });
      } catch (err: any) {
        console.error("[PriceSync EventProducer Error]", err?.message || err);
      }
    }

    return { added: false, priceChanged: true, skipped: false };

  } else {
    // Price did NOT change: Idempotent update of lastSeenAt & DealAnalysis only
    await prisma.$transaction([
      prisma.game.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: effectiveNow,
          productClass: product.productClass,
          imageUrl: product.imageUrl || existing.imageUrl,
          platforms: effectivePlatforms.length > 0 ? effectivePlatforms : existing.platforms,
          isSeriesXCompatible: effectiveSeriesX,
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
          calculatedAt: effectiveNow,
        },
        update: {
          dealScore: analysis.dealScore,
          confidenceScore: analysis.confidenceScore,
          historicalPosition: analysis.historicalPosition,
          saleFrequency: analysis.saleFrequency,
          verdict: analysis.verdict,
          reason: analysis.reason,
          calculatedAt: effectiveNow,
        },
      }),
    ]);

    return { added: false, priceChanged: false, skipped: false };
  }
}
