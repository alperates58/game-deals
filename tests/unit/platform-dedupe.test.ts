import { describe, it, expect } from "vitest";
import {
  cleanPlatformTitle,
  mergePlatformArrays,
  formatPlatformLabel,
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
