export interface NormalizedXboxProduct {
  productId: string;
  title: string;
  normalizedTitle: string;
  slug: string;
  publisher?: string;
  productType: string;
  imageUrl?: string;
  storeUrl: string;

  listPrice: number;
  currentPrice: number;
  currency: string;
  discountPercent: number;

  isOnSale: boolean;
  saleStartAt?: Date | null;
  saleEndAt?: Date | null;

  platforms: string[];
  isFree: boolean;
  source: "MICROSOFT_DISPLAY_CATALOG";
}

export type ConfidenceScore = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export type DealVerdictCode = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "WAIT" | "POOR";

export interface DealAnalysisResult {
  dealScore: number;
  confidenceScore: ConfidenceScore;
  historicalPosition: number;
  saleFrequency: number;
  daysSinceBetterPrice: number | null;
  verdict: DealVerdictCode;
  verdictLabel: string;
  reason: string;
}

export interface CollectorConfig {
  market: string;
  language: string;
  batchSize: number;
  maxConcurrency: number;
  requestDelayMinMs: number;
  requestDelayMaxMs: number;
  requestTimeoutMs: number;
  maxRetries: number;
}
