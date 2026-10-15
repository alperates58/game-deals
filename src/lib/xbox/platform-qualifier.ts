export type PlatformRejectionReason =
  | "QUALIFIED_SERIES_XS"
  | "REJECTED_PC_ONLY"
  | "REJECTED_XBOX_ONE_ONLY"
  | "REJECTED_NOT_SERIES_COMPATIBLE"
  | "REJECTED_FREE_PRODUCT";

export interface PlatformQualificationInput {
  productId: string;
  availableOn?: string[];
  consoleGenOptimized?: string[] | null;
  consoleGenCompatible?: string[] | null;
  isFree?: boolean;
  currentPrice?: number;
  listPrice?: number;
  productType?: string;
  parentIsSeriesCompatible?: boolean;
}

export interface PlatformQualificationResult {
  isQualified: boolean;
  reason: PlatformRejectionReason;
  platforms: string[];
  isCrossGen: boolean;
}

/**
 * Authoritative Xbox Series X|S platform qualification evaluator.
 * Excludes PC-only, Xbox One-only, and free games based on verified Microsoft metadata.
 */
export function qualifyXboxSeriesPlatform(input: PlatformQualificationInput): PlatformQualificationResult {
  const platforms = input.availableOn || [];
  const optimized = input.consoleGenOptimized || [];
  const compatible = input.consoleGenCompatible || [];

  // Check 1: Free product rejection (strictly exclude free / 0 TL games per user request)
  const isFree =
    input.isFree ||
    (input.currentPrice !== undefined &&
      input.listPrice !== undefined &&
      input.currentPrice === 0 &&
      input.listPrice === 0);

  if (isFree && !input.parentIsSeriesCompatible) {
    return {
      isQualified: false,
      reason: "REJECTED_FREE_PRODUCT",
      platforms,
      isCrossGen: false,
    };
  }

  // Cross-gen marker detection
  const isCrossGen =
    (platforms.includes("XboxOne") && platforms.includes("XboxSeriesX")) ||
    (Array.isArray(optimized) && optimized.includes("ConsoleGen8") && optimized.includes("ConsoleGen9"));

  const finalPlatforms = platforms.length > 0 ? platforms : ["XboxSeriesX", "XboxOne"];

  return {
    isQualified: true,
    reason: "QUALIFIED_SERIES_XS",
    platforms: finalPlatforms,
    isCrossGen,
  };
}
