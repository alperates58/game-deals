import { ProductClass, RelationType } from "@prisma/client";

export type { ProductClass, RelationType };

export interface NormalizedXboxProduct {
  productId: string;
  title: string;
  normalizedTitle: string;
  slug: string;
  publisher?: string;
  developer?: string;
  productType: string;
  productClass: ProductClass;
  imageUrl?: string;
  storeUrl: string;

  shortDescription?: string;
  longDescription?: string;
  releaseDate?: Date | null;
  genres: string[];
  capabilities: string[];
  screenshots: string[];

  listPrice: number;
  currentPrice: number;
  currency: string;
  discountPercent: number;

  isOnSale: boolean;
  saleStartAt?: Date | null;
  saleEndAt?: Date | null;

  platforms: string[];
  isFree: boolean;

  // Authoritative relationships from Display Catalog
  bundledProductIds: string[];
  parentProductId?: string;

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
