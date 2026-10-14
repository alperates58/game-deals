import { describe, it, expect } from "vitest";
import { calculateDealScore } from "../../src/lib/pricing/deal-score";
import { calculateConfidence } from "../../src/lib/pricing/confidence";
import { evaluateObservedLow } from "../../src/lib/pricing/observed-low";
import { generateSlug } from "../../src/lib/pricing/slug";

describe("Pricing Engine Unit Tests", () => {
  describe("Price Normalization & Observed Low (FR-05)", () => {
    it("should set historical low when no previous low exists", () => {
      const result = evaluateObservedLow(499, null, null);
      expect(result.isNewLow).toBe(true);
      expect(result.historicalLow).toBe(499);
    });

    it("should detect new lower historical low", () => {
      const result = evaluateObservedLow(299, 499, new Date("2026-01-01"));
      expect(result.isNewLow).toBe(true);
      expect(result.historicalLow).toBe(299);
    });

    it("should not update historical low if price is higher", () => {
      const oldDate = new Date("2026-01-01");
      const result = evaluateObservedLow(599, 499, oldDate);
      expect(result.isNewLow).toBe(false);
      expect(result.historicalLow).toBe(499);
      expect(result.historicalLowAt).toBe(oldDate);
    });
  });

  describe("Deal Score V1 Calculation (FR-06)", () => {
    it("should award maximum deal score (EXCELLENT) when at historical low with deep discount", () => {
      const result = calculateDealScore({
        currentPrice: 200,
        listPrice: 1000, // 80% discount
        historicalLow: 200, // at low
        firstSeenAt: new Date("2026-01-01"),
        priceHistoryCount: 10,
        saleHistoryCount: 2,
      });

      expect(result.dealScore).toBeGreaterThanOrEqual(90);
      expect(result.verdict).toBe("EXCELLENT");
      expect(result.verdictLabel).toBe("🔥 Kaçırma");
      expect(result.reason).toContain("en düşük fiyatında");
    });

    it("should produce POOR verdict when at list price with no discount", () => {
      const result = calculateDealScore({
        currentPrice: 1000,
        listPrice: 1000, // 0% discount
        historicalLow: 500, // far from low
        firstSeenAt: new Date("2026-01-01"),
        priceHistoryCount: 5,
        saleHistoryCount: 2,
      });

      expect(result.dealScore).toBeLessThanOrEqual(44);
      expect(result.verdict).toBe("POOR");
      expect(result.verdictLabel).toBe("🔴 Zayıf Fırsat");
      expect(result.reason).toContain("standart liste fiyatından");
    });

    it("should produce WAIT verdict when discount is superficial and far from historical low", () => {
      const result = calculateDealScore({
        currentPrice: 650,
        listPrice: 1000, // 35% discount
        historicalLow: 300, // historical low was 300
        firstSeenAt: new Date("2026-01-01"),
        priceHistoryCount: 10,
        saleHistoryCount: 3,
      });

      expect(result.verdict).toBe("WAIT");
      expect(result.verdictLabel).toBe("🟠 Bekle");
    });
  });

  describe("Confidence Level Calculation (FR-07)", () => {
    const now = new Date("2026-10-14");

    it("should return LOW confidence for items tracked < 15 days", () => {
      const seen = new Date("2026-10-05"); // 9 days ago
      const conf = calculateConfidence(seen, now);
      expect(conf.score).toBe("LOW");
      expect(conf.label).toBe("Yeni Takip");
    });

    it("should return MEDIUM confidence for items tracked 15-59 days", () => {
      const seen = new Date("2026-09-01"); // ~43 days ago
      const conf = calculateConfidence(seen, now);
      expect(conf.score).toBe("MEDIUM");
      expect(conf.label).toBe("Orta Güven");
    });

    it("should return HIGH confidence for items tracked 60-179 days", () => {
      const seen = new Date("2026-06-01"); // ~135 days ago
      const conf = calculateConfidence(seen, now);
      expect(conf.score).toBe("HIGH");
      expect(conf.label).toBe("Yüksek Güven");
    });

    it("should return VERY_HIGH confidence for items tracked 180+ days", () => {
      const seen = new Date("2026-01-01"); // ~286 days ago
      const conf = calculateConfidence(seen, now);
      expect(conf.score).toBe("VERY_HIGH");
      expect(conf.label).toBe("Çok Yüksek Güven");
    });
  });

  describe("Turkish Slug Generation (FR-08)", () => {
    it("should properly normalize Turkish characters and spaces", () => {
      const slug = generateSlug("Grand Theft Auto V: Çılgın Fırsat & Özel Sürüm!");
      expect(slug).toBe("grand-theft-auto-v-cilgin-firsat-ozel-surum");
    });

    it("should remove consecutive hyphens and special symbols", () => {
      const slug = generateSlug("Far Cry® 6 --- Yılın Oyunu");
      expect(slug).toBe("far-cry-6-yilin-oyunu");
    });

    it("should handle empty or whitespace string safely", () => {
      const slug = generateSlug("   ");
      expect(slug).toBe("oyun");
    });
  });
});
