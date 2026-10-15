import { SafeRateLimiter } from "./rate-limiter";
import { XboxCatalogResponseSchema } from "./schemas";
import { mapDisplayCatalogProduct } from "./mapper";
import { NormalizedXboxProduct, CollectorConfig } from "./types";

const DEFAULT_CONFIG: CollectorConfig = {
  market: process.env.XBOX_MARKET || "TR",
  language: process.env.XBOX_LANGUAGE || "tr-TR",
  batchSize: parseInt(process.env.XBOX_BATCH_SIZE || "25", 10),
  maxConcurrency: parseInt(process.env.XBOX_MAX_CONCURRENCY || "2", 10),
  requestDelayMinMs: parseInt(process.env.XBOX_REQUEST_DELAY_MIN_MS || "750", 10),
  requestDelayMaxMs: parseInt(process.env.XBOX_REQUEST_DELAY_MAX_MS || "1500", 10),
  requestTimeoutMs: parseInt(process.env.XBOX_REQUEST_TIMEOUT_MS || "15000", 10),
  maxRetries: parseInt(process.env.XBOX_MAX_RETRIES || "4", 10),
};

export class XboxCatalogClient {
  private rateLimiter: SafeRateLimiter;
  private config: CollectorConfig;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new SafeRateLimiter({
      minDelayMs: this.config.requestDelayMinMs,
      maxDelayMs: this.config.requestDelayMaxMs,
      maxConcurrency: this.config.maxConcurrency,
      maxRetries: this.config.maxRetries,
    });
  }

  public async fetchProductsBatch(bigIds: string[]): Promise<NormalizedXboxProduct[]> {
    if (bigIds.length === 0) return [];

    const cleanIds = bigIds.map((id) => id.trim().toUpperCase()).filter(Boolean);
    const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${cleanIds.join(",")}&market=${this.config.market}&languages=${this.config.language}`;

    return this.rateLimiter.executeWithRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

        try {
          return await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "application/json",
            },
          });
        } finally {
          clearTimeout(timeoutId);
        }
      },
      async (response) => {
        const rawJson = await response.json();
        const parseResult = XboxCatalogResponseSchema.safeParse(rawJson);

        if (!parseResult.success) {
          console.warn("[XboxCatalogClient] Validation warnings for catalog batch:", parseResult.error.format());
          // Extract valid items anyway if present
          const products = (rawJson.Products || []) as any[];
          const valid: NormalizedXboxProduct[] = [];
          for (const raw of products) {
            try {
              const mapped = mapDisplayCatalogProduct(raw);
              if (mapped) valid.push(mapped);
            } catch (err) {
              console.error("[XboxCatalogClient] Failed to map single product:", err);
            }
          }
          return valid;
        }

        const normalized: NormalizedXboxProduct[] = [];
        for (const rawProduct of parseResult.data.Products) {
          const mapped = mapDisplayCatalogProduct(rawProduct);
          if (mapped) {
            normalized.push(mapped);
          }
        }
        return normalized;
      }
    );
  }

  public async fetchAllInBatches(
    allBigIds: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<NormalizedXboxProduct[]> {
    const uniqueIds = Array.from(new Set(allBigIds.map((id) => id.trim().toUpperCase()))).filter(Boolean);
    const results: NormalizedXboxProduct[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const chunk = uniqueIds.slice(i, i + batchSize);
      try {
        const batchResults = await this.fetchProductsBatch(chunk);
        results.push(...batchResults);
      } catch (err: any) {
        console.error(`[XboxCatalogClient] Batch failed for IDs ${chunk.join(",")}:`, err.message);
      }

      if (onProgress) {
        onProgress(Math.min(i + batchSize, uniqueIds.length), uniqueIds.length);
      }
    }

    return results;
  }
}

export const catalogClient = new XboxCatalogClient();
