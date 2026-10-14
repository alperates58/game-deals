import { describe, it, expect } from "vitest";
import { qualifyXboxSeriesPlatform } from "../../src/lib/xbox/platform-qualifier";

describe("Series X|S Platform Qualifier Tests", () => {
  it("should qualify native Xbox Series X|S product via ConsoleGen9", () => {
    const result = qualifyXboxSeriesPlatform({
      productId: "9NWQ1Q1FR0C9",
      consoleGenOptimized: ["ConsoleGen9"],
      availableOn: ["XboxSeriesX"],
      currentPrice: 2499,
      listPrice: 2499,
      isFree: false,
    });

    expect(result.isQualified).toBe(true);
    expect(result.reason).toBe("QUALIFIED_SERIES_XS");
    expect(result.platforms).toContain("XboxSeriesX");
  });

  it("should qualify cross-generation product supporting Series X|S", () => {
    const result = qualifyXboxSeriesPlatform({
      productId: "CROSSGEN123",
      consoleGenOptimized: ["ConsoleGen8", "ConsoleGen9"],
      availableOn: ["XboxOne", "XboxSeriesX"],
      currentPrice: 1200,
      listPrice: 1500,
      isFree: false,
    });

    expect(result.isQualified).toBe(true);
    expect(result.reason).toBe("QUALIFIED_SERIES_XS");
    expect(result.isCrossGen).toBe(true);
  });

  it("should reject PC-only products", () => {
    const result = qualifyXboxSeriesPlatform({
      productId: "PCONLY123",
      availableOn: ["PC"],
      consoleGenOptimized: [],
      consoleGenCompatible: [],
      currentPrice: 500,
      listPrice: 500,
      isFree: false,
    });

    expect(result.isQualified).toBe(false);
    expect(result.reason).toBe("REJECTED_PC_ONLY");
  });

  it("should reject Xbox One-only products with no Series X|S support", () => {
    const result = qualifyXboxSeriesPlatform({
      productId: "XB1ONLY123",
      availableOn: ["XboxOne"],
      consoleGenOptimized: ["ConsoleGen8"],
      consoleGenCompatible: ["ConsoleGen8"],
      currentPrice: 300,
      listPrice: 300,
      isFree: false,
    });

    expect(result.isQualified).toBe(false);
    expect(result.reason).toBe("REJECTED_XBOX_ONE_ONLY");
  });

  it("should reject free products from primary catalog", () => {
    const result = qualifyXboxSeriesPlatform({
      productId: "FREE123",
      availableOn: ["XboxSeriesX"],
      consoleGenOptimized: ["ConsoleGen9"],
      currentPrice: 0,
      listPrice: 0,
      isFree: true,
    });

    expect(result.isQualified).toBe(false);
    expect(result.reason).toBe("REJECTED_FREE_PRODUCT");
  });

  it("should allow free base game when parentIsSeriesCompatible is true for DLC relationship", () => {
    const result = qualifyXboxSeriesPlatform({
      productId: "FREEPARENT123",
      availableOn: ["XboxSeriesX"],
      consoleGenOptimized: ["ConsoleGen9"],
      currentPrice: 0,
      listPrice: 0,
      isFree: true,
      parentIsSeriesCompatible: true,
    });

    expect(result.isQualified).toBe(true);
    expect(result.reason).toBe("QUALIFIED_SERIES_XS");
  });
});
