import { describe, it, expect, vi } from "vitest";
import { mapDisplayCatalogProduct } from "../../src/lib/xbox/mapper";
import { XboxProductRawSchema } from "../../src/lib/xbox/schemas";
import { SafeRateLimiter } from "../../src/lib/xbox/rate-limiter";

describe("Xbox Source Adapter Unit Tests", () => {
  const mockProductRaw = {
    ProductId: "9NXFX68ZNKK0",
    ProductType: "Game",
    LocalizedProperties: [
      {
        ProductTitle: "Grand Theft Auto V",
        PublisherName: "Rockstar Games",
        Images: [
          {
            ImagePurpose: "Poster",
            Uri: "//store-images.s-microsoft.com/image/apps.poster.png",
          },
        ],
      },
    ],
    DisplaySkuAvailabilities: [
      {
        Sku: { SkuId: "0010" },
        Availabilities: [
          {
            AvailabilityId: "9XGJP7ZQ0DV5",
            Actions: ["Purchase", "Details"],
            Conditions: {
              StartDate: "2026-10-01T00:00:00Z",
              EndDate: "2026-10-25T00:00:00Z",
              ClientConditions: {
                AllowedPlatforms: [{ PlatformName: "Windows.Xbox" }],
              },
            },
            OrderManagementData: {
              Price: {
                CurrencyCode: "TRY",
                ListPrice: 450,
                MSRP: 900,
              },
            },
          },
        ],
      },
    ],
  };

  describe("API Mapping & Normalization", () => {
    it("should successfully map valid Display Catalog product to NormalizedXboxProduct", () => {
      const normalized = mapDisplayCatalogProduct(mockProductRaw as any);
      expect(normalized).not.toBeNull();
      expect(normalized?.productId).toBe("9NXFX68ZNKK0");
      expect(normalized?.title).toBe("Grand Theft Auto V");
      expect(normalized?.publisher).toBe("Rockstar Games");
      expect(normalized?.currentPrice).toBe(450);
      expect(normalized?.listPrice).toBe(900);
      expect(normalized?.discountPercent).toBe(50);
      expect(normalized?.isOnSale).toBe(true);
      expect(normalized?.imageUrl).toBe("https://store-images.s-microsoft.com/image/apps.poster.png");
      expect(normalized?.platforms).toContain("Xbox");
    });
  });

  describe("Free Game Filtering (FR-02)", () => {
    it("should accurately mark zero-price products as isFree", () => {
      const freeProduct = {
        ...mockProductRaw,
        DisplaySkuAvailabilities: [
          {
            Sku: { SkuId: "0001" },
            Availabilities: [
              {
                AvailabilityId: "B1WTXKT59HR7",
                Actions: ["Purchase"],
                OrderManagementData: {
                  Price: {
                    CurrencyCode: "TRY",
                    ListPrice: 0,
                    MSRP: 0,
                  },
                },
              },
            ],
          },
        ],
      };

      const normalized = mapDisplayCatalogProduct(freeProduct as any);
      expect(normalized?.isFree).toBe(true);
      expect(normalized?.currentPrice).toBe(0);
      expect(normalized?.listPrice).toBe(0);
    });
  });

  describe("Invalid Upstream Payload Handling", () => {
    it("should safely validate schemas with Zod and not throw unhandled exceptions", () => {
      const invalidProduct = {
        ProductId: "INVALID_TEST",
      };

      const result = XboxProductRawSchema.safeParse(invalidProduct);
      expect(result.success).toBe(true); // ProductType defaults to "Game"
      if (result.success) {
        expect(result.data.ProductType).toBe("Game");
      }
    });

    it("should return null gracefully when no TRY pricing exists in availability", () => {
      const usdOnlyProduct = {
        ...mockProductRaw,
        DisplaySkuAvailabilities: [
          {
            Sku: { SkuId: "0001" },
            Availabilities: [
              {
                AvailabilityId: "123",
                Actions: ["Purchase"],
                OrderManagementData: {
                  Price: {
                    CurrencyCode: "USD",
                    ListPrice: 20,
                  },
                },
              },
            ],
          },
        ],
      };

      const normalized = mapDisplayCatalogProduct(usdOnlyProduct as any);
      expect(normalized).toBeNull();
    });
  });

  describe("Rate Limiter, 429 Retry and 5xx Backoff (NFR-REL-01, NFR-REL-02)", () => {
    it("should retry on HTTP 429 and eventually succeed", async () => {
      const limiter = new SafeRateLimiter({
        minDelayMs: 10,
        maxDelayMs: 20,
        maxRetries: 2,
        baseBackoffMs: 20,
      });

      let callCount = 0;
      const fakeFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(null, {
            status: 429,
            headers: { "retry-after": "0" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const res = await limiter.executeWithRetry(fakeFetch, async (r) => r.json());
      expect(res.ok).toBe(true);
      expect(callCount).toBe(2);
    });

    it("should backoff on HTTP 500 and succeed on retry", async () => {
      const limiter = new SafeRateLimiter({
        minDelayMs: 10,
        maxDelayMs: 20,
        maxRetries: 2,
        baseBackoffMs: 20,
      });

      let callCount = 0;
      const fakeFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(null, { status: 503, statusText: "Service Unavailable" });
        }
        return new Response(JSON.stringify({ status: "recovered" }), { status: 200 });
      });

      const res = await limiter.executeWithRetry(fakeFetch, async (r) => r.json());
      expect(res.status).toBe("recovered");
      expect(callCount).toBe(2);
    });
  });
});
