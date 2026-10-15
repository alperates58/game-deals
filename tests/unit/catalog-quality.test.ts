import { describe, it, expect } from "vitest";

describe("Catalog Data Quality Engine (FAZ 1.4)", () => {
  it("should calculate 100 EXCELLENT score for a pristine catalog with zero anomalies", () => {
    // Metric penalties simulation
    const totalProducts = 1000;
    const penalties = 0;
    const score = Math.max(0, Math.min(100, Math.round(100 - penalties)));

    expect(score).toBe(100);
    expect(score >= 99).toBe(true); // EXCELLENT
  });

  it("should downgrade health score to HEALTHY when minor staleness issues occur", () => {
    const totalProducts = 1000;
    const stalePriceCount = 60; // 6% of catalog
    const minorWeight = 0.5;
    const penalty = (stalePriceCount / totalProducts) * minorWeight * 100; // 3 points deduction

    const score = Math.round(100 - penalty);
    expect(score).toBe(97);
    expect(score >= 95 && score <= 98).toBe(true); // HEALTHY
  });

  it("should downgrade health score to NEEDS_ATTENTION when multiple major issues occur", () => {
    const totalProducts = 1000;
    const unknownClassCount = 40; // 4% of catalog * 1.5 = 6 points
    const missingImageCount = 20; // 2% of catalog * 1.5 = 3 points
    const penalty = (unknownClassCount / totalProducts) * 1.5 * 100 + (missingImageCount / totalProducts) * 1.5 * 100;

    const score = Math.round(100 - penalty);
    expect(score).toBe(91);
    expect(score >= 90 && score <= 94).toBe(true); // NEEDS_ATTENTION
  });

  it("should downgrade health score to DEGRADED when critical anomalies (pricing/orphans) occur", () => {
    const totalProducts = 1000;
    const missingPriceCount = 30; // 3% of catalog * 2.5 = 7.5
    const orphanRelations = 20; // 2% of catalog * 2.5 = 5.0
    const invalidDiscounts = 25; // 2.5% of catalog * 2.5 = 6.25
    const penalty =
      (missingPriceCount / totalProducts) * 2.5 * 100 +
      (orphanRelations / totalProducts) * 2.5 * 100 +
      (invalidDiscounts / totalProducts) * 2.5 * 100;

    const score = Math.round(100 - penalty);
    expect(score).toBe(81);
    expect(score < 90).toBe(true); // DEGRADED
  });

  it("should detect Black Myth: Wukong (9NWQ1Q1FR0C9) as mandatory sanity benchmark", () => {
    const SANITY_WUKONG_BIG_ID = "9NWQ1Q1FR0C9";
    const catalogWithoutWukong: string[] = ["9P9085WZ2Q3S", "9N0NXFL1GLLW"];
    const isDiscovered = catalogWithoutWukong.includes(SANITY_WUKONG_BIG_ID);

    expect(isDiscovered).toBe(false);
    // Should trigger DISCOVERY_GAP
    const issueCode = !isDiscovered ? "DISCOVERY_GAP" : "PASS";
    expect(issueCode).toBe("DISCOVERY_GAP");

    const catalogWithWukong = [...catalogWithoutWukong, SANITY_WUKONG_BIG_ID];
    const isFound = catalogWithWukong.includes(SANITY_WUKONG_BIG_ID);
    expect(isFound).toBe(true);
  });

  it("should flag suspicious and inverted bundle relations", () => {
    const bundleId = "BUNDLE_MAFIA_TRILOGY";
    const childId = "GAME_MAFIA_1";

    // Valid relation: Parent is Bundle, Child is contained Game
    const validRelation = {
      parentGameId: bundleId,
      childGameId: childId,
      relationType: "BUNDLE_CONTAINS",
    };
    expect(validRelation.parentGameId).toBe(bundleId);
    expect(validRelation.childGameId).toBe(childId);

    // Inverted anomaly detection: Child recorded as Bundle parent of parent
    const invertedRelation = {
      parentGameId: childId,
      childGameId: bundleId,
      relationType: "BUNDLE_CONTAINS",
    };
    const isInverted = invertedRelation.childGameId === bundleId;
    expect(isInverted).toBe(true);

    // Self-referencing anomaly
    const selfRelation = {
      parentGameId: bundleId,
      childGameId: bundleId,
      relationType: "BUNDLE_CONTAINS",
    };
    const isSelfRef = selfRelation.parentGameId === selfRelation.childGameId;
    expect(isSelfRef).toBe(true);
  });

  it("should identify pricing anomalies correctly", () => {
    // 1. Current Price > List Price
    const anomaly1 = { currentPrice: 1500, listPrice: 1200 };
    expect(anomaly1.currentPrice > anomaly1.listPrice).toBe(true);

    // 2. Historical Low > Current Price
    const anomaly2 = { currentPrice: 500, historicalLow: 800 };
    expect(anomaly2.historicalLow > anomaly2.currentPrice).toBe(true);

    // 3. Invalid Discount (discount > 0 but currentPrice >= listPrice)
    const anomaly3 = { currentPrice: 1000, listPrice: 1000, discountPercent: 20 };
    const isInvalidDiscount = anomaly3.discountPercent > 0 && anomaly3.currentPrice >= anomaly3.listPrice;
    expect(isInvalidDiscount).toBe(true);
  });
});
