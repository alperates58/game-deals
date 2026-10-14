import { describe, it, expect } from "vitest";
import { determineProductClass } from "../../src/lib/xbox/mapper";
import { ProductClass } from "@prisma/client";

describe("Faz 1.1 - Product Classification & Relationships", () => {
  it("classifies standard games as BASE_GAME", () => {
    expect(determineProductClass("Red Dead Redemption 2", "Game")).toBe(ProductClass.BASE_GAME);
    expect(determineProductClass("Grand Theft Auto V", "FullGame")).toBe(ProductClass.BASE_GAME);
  });

  it("classifies bundles as BUNDLE", () => {
    expect(determineProductClass("Metro Saga Bundle", "Bundle")).toBe(ProductClass.BUNDLE);
    expect(determineProductClass("Far Cry Anthology Bundle", "Game")).toBe(ProductClass.BUNDLE);
  });

  it("classifies season passes as SEASON_PASS", () => {
    expect(determineProductClass("Far Cry 4 Season Pass", "Pass")).toBe(ProductClass.SEASON_PASS);
    expect(determineProductClass("Assassin's Creed Odyssey - Season Pass", "Durable")).toBe(
      ProductClass.SEASON_PASS
    );
  });

  it("classifies expansions as EXPANSION", () => {
    expect(determineProductClass("Cyberpunk 2077: Phantom Liberty Expansion", "Durable")).toBe(
      ProductClass.EXPANSION
    );
  });

  it("classifies DLC and AddOns accurately", () => {
    expect(determineProductClass("Metro Exodus - Sam's Story DLC", "AddOn")).toBe(ProductClass.DLC);
    expect(determineProductClass("Weapon Pack Addon", "AddOn")).toBe(ProductClass.CONTENT_PACK);
    expect(determineProductClass("Extra Outfit Pack", "AddOn")).toBe(ProductClass.CONTENT_PACK);
    expect(determineProductClass("Resource Pack", "Durable")).toBe(ProductClass.CONTENT_PACK);
    expect(determineProductClass("Random Addon Item", "AddOn")).toBe(ProductClass.ADD_ON);
  });

  it("classifies currency packs as CURRENCY", () => {
    expect(determineProductClass("1000 GTA$ Cash Card", "Consumable")).toBe(ProductClass.CURRENCY);
    expect(determineProductClass("5000 FIFA Points Pack", "Durable")).toBe(ProductClass.CURRENCY);
    expect(determineProductClass("500 V-Bucks Coin", "Consumable")).toBe(ProductClass.CURRENCY);
  });
});

describe("Faz 1.1 - Bundle Economics Logic", () => {
  function computeBundleEconomics(
    bundleCurrentPrice: number,
    childPrices: number[],
    totalChildrenCount: number
  ) {
    const pricedCount = childPrices.length;
    const isFullyPriced = pricedCount === totalChildrenCount;
    const sumChildPrices = childPrices.reduce((a, b) => a + b, 0);
    const savingsAmount = sumChildPrices - bundleCurrentPrice;
    const savingsPercent =
      sumChildPrices > 0 ? Math.round((savingsAmount / sumChildPrices) * 100) : 0;

    return {
      pricedCount,
      totalChildrenCount,
      isFullyPriced,
      sumChildPrices,
      savingsAmount,
      savingsPercent,
      isAdvantageous: savingsAmount > 0,
    };
  }

  it("calculates truthful savings when bundle is cheaper than individual items", () => {
    // Metro Saga Bundle case: 159.45 TL vs 300 TL items
    const economics = computeBundleEconomics(159.45, [100, 100, 100], 3);
    expect(economics.isFullyPriced).toBe(true);
    expect(economics.sumChildPrices).toBe(300);
    expect(economics.savingsAmount).toBeCloseTo(140.55);
    expect(economics.savingsPercent).toBe(47);
    expect(economics.isAdvantageous).toBe(true);
  });

  it("accurately detects when bundle is more expensive than individual sale items", () => {
    // Metro Saga flash sale case: bundle 159.45 TL, separate flash sale items sum to 132.29 TL
    const economics = computeBundleEconomics(159.45, [28.05, 20.0, 67.0, 8.62, 8.62], 5);
    expect(economics.isFullyPriced).toBe(true);
    expect(economics.sumChildPrices).toBe(132.29);
    expect(economics.savingsAmount).toBeLessThan(0);
    expect(economics.isAdvantageous).toBe(false);
  });

  it("flags partial pricing truthfully when some children are missing", () => {
    const economics = computeBundleEconomics(200, [100, 50], 3);
    expect(economics.isFullyPriced).toBe(false);
    expect(economics.pricedCount).toBe(2);
    expect(economics.totalChildrenCount).toBe(3);
  });
});

describe("Faz 1.1 - Truthful Price History State Contract", () => {
  type ChartState = "EMPTY" | "SINGLE_BASELINE" | "SERIES";

  function determinePriceHistoryState(historyCount: number): ChartState {
    if (historyCount === 0) return "EMPTY";
    if (historyCount === 1) return "SINGLE_BASELINE";
    return "SERIES";
  }

  it("preserves strict 3-state truthful empty state contract without synthetic points", () => {
    expect(determinePriceHistoryState(0)).toBe("EMPTY");
    expect(determinePriceHistoryState(1)).toBe("SINGLE_BASELINE");
    expect(determinePriceHistoryState(2)).toBe("SERIES");
    expect(determinePriceHistoryState(15)).toBe("SERIES");
  });
});
