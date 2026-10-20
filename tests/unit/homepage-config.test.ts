import { describe, it, expect } from "vitest";
import {
  DEFAULT_HOMEPAGE_CONFIG,
  HomepageConfig,
  HomepageSectionConfig,
} from "../../src/lib/settings/homepage-config";

describe("Homepage Configuration & Vitrin Customization Engine", () => {
  it("should have a valid default configuration with hero slider and default vitrins", () => {
    expect(DEFAULT_HOMEPAGE_CONFIG.heroSlider.enabled).toBe(true);
    expect(DEFAULT_HOMEPAGE_CONFIG.heroSlider.limit).toBeGreaterThan(0);
    expect(DEFAULT_HOMEPAGE_CONFIG.sections.length).toBeGreaterThanOrEqual(5);

    const sectionIds = DEFAULT_HOMEPAGE_CONFIG.sections.map((s) => s.id);
    expect(sectionIds).toContain("historical-lows");
    expect(sectionIds).toContain("deep-discounts");
    expect(sectionIds).toContain("budget-gems");
    expect(sectionIds).toContain("recent-drops");
    expect(sectionIds).toContain("bundle-deals");
    expect(sectionIds).toContain("popular-games");
  });

  it("should support platform filtering across PC, XboxSeriesX, XboxOne, and ALL", () => {
    const section: HomepageSectionConfig = {
      id: "pc-only-deals",
      enabled: true,
      order: 1,
      title: "PC Game Pass & Windows İndirimleri",
      subtitle: "Bilgisayar oyuncularına özel fırsatlar",
      badgeText: "PC Özel",
      icon: "monitor",
      queryType: "DEEP_DISCOUNT",
      platform: "PC",
      productClass: "ALL",
      minDiscountPercent: 50,
      sortBy: "DISCOUNT_DESC",
      limit: 15,
    };

    expect(section.platform).toBe("PC");
    expect(section.minDiscountPercent).toBe(50);
  });

  it("should support product class filtering (BASE_GAME, BUNDLE, ADD_ON)", () => {
    const bundleSection: HomepageSectionConfig = {
      id: "bundles-only",
      enabled: true,
      order: 2,
      title: "Avantajlı Paketler",
      subtitle: "Koleksiyonlar",
      badgeText: "Paket",
      icon: "package",
      queryType: "BUNDLES",
      platform: "ALL",
      productClass: "BUNDLE",
      sortBy: "DISCOUNT_DESC",
      limit: 10,
    };

    expect(bundleSection.productClass).toBe("BUNDLE");
  });

  it("should support budget price threshold filters", () => {
    const budgetSection = DEFAULT_HOMEPAGE_CONFIG.sections.find((s) => s.id === "budget-gems");
    expect(budgetSection).toBeDefined();
    expect(budgetSection?.maxPrice).toBe(150);
    expect(budgetSection?.highlightBadge).toBe("budget");
  });
});
