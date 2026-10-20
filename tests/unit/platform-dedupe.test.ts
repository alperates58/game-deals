import { describe, it, expect } from "vitest";
import {
  cleanPlatformTitle,
  mergePlatformArrays,
  formatPlatformLabel,
  getProductGroup,
} from "../../src/lib/xbox/platform-dedupe";

describe("Cross-Platform Title Cleaning & Deduplication", () => {
  it("should strip (Windows) suffix and detect PC platform", () => {
    const res = cleanPlatformTitle("Candlemates (Windows)");
    expect(res.baseTitle).toBe("Candlemates");
    expect(res.detectedPlatform).toBe("PC");
  });

  it("should strip (Xbox One) suffix and detect XboxOne platform", () => {
    const res = cleanPlatformTitle("Candlemates (Xbox One)");
    expect(res.baseTitle).toBe("Candlemates");
    expect(res.detectedPlatform).toBe("XboxOne");
  });

  it("should strip (Xbox Series X|S) suffix and detect XboxSeriesX platform", () => {
    const res = cleanPlatformTitle("Candlemates (Xbox Series X|S)");
    expect(res.baseTitle).toBe("Candlemates");
    expect(res.detectedPlatform).toBe("XboxSeriesX");
  });

  it("should strip (Xbox One & Xbox Series X|S) cross-gen suffix", () => {
    const res = cleanPlatformTitle("Grand Theft Auto V (Xbox One & Xbox Series X|S)");
    expect(res.baseTitle).toBe("Grand Theft Auto V");
    expect(res.detectedPlatform).toBe("CrossGen");
  });

  it("should handle (Xbox Series), (Windows PC), and no-space suffixes", () => {
    const res1 = cleanPlatformTitle("Gas Station Simulator (Xbox Series)");
    expect(res1.baseTitle).toBe("Gas Station Simulator");
    expect(res1.detectedPlatform).toBe("XboxSeriesX");

    const res2 = cleanPlatformTitle("Mafia: Definitive Edition (Windows PC)");
    expect(res2.baseTitle).toBe("Mafia: Definitive Edition");
    expect(res2.detectedPlatform).toBe("PC");

    const res3 = cleanPlatformTitle("DRAGON BALL FIGHTERZ(Xbox One)");
    expect(res3.baseTitle).toBe("DRAGON BALL FIGHTERZ");
    expect(res3.detectedPlatform).toBe("XboxOne");

    const res4 = cleanPlatformTitle("KAWAII PUSH (XBOX SERIES)");
    expect(res4.baseTitle).toBe("KAWAII PUSH");
    expect(res4.detectedPlatform).toBe("XboxSeriesX");
  });

  it("should classify BASE_GAME and BUNDLE into GAME group", () => {
    expect(getProductGroup("BASE_GAME")).toBe("GAME");
    expect(getProductGroup("BUNDLE")).toBe("GAME");
    expect(getProductGroup("ADD_ON")).toBe("DLC");
    expect(getProductGroup("CONTENT_PACK")).toBe("DLC");
  });

  it("should handle for Windows and - PC variations", () => {
    const res1 = cleanPlatformTitle("Classic Costume Pack for Windows");
    expect(res1.baseTitle).toBe("Classic Costume Pack");
    expect(res1.detectedPlatform).toBe("PC");

    const res2 = cleanPlatformTitle("Red Dead Redemption (PC)");
    expect(res2.baseTitle).toBe("Red Dead Redemption");
    expect(res2.detectedPlatform).toBe("PC");
  });

  it("should merge platform arrays without duplicates in standard order", () => {
    const merged = mergePlatformArrays(["Xbox", "XboxSeriesX"], ["PC", "XboxOne", "Xbox"]);
    expect(merged).toEqual(["PC", "XboxSeriesX", "XboxOne", "Xbox"]);
  });

  it("should format platform labels cleanly", () => {
    expect(formatPlatformLabel("PC").label).toBe("Windows 10/11 PC");
    expect(formatPlatformLabel("XboxSeriesX").label).toBe("Xbox Series X|S");
    expect(formatPlatformLabel("XboxOne").label).toBe("Xbox One");
  });
});
