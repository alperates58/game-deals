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

  // Check 1: Free product rejection from primary catalog
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

  // Check 2: Direct Display Catalog Gen9 markers (Xbox Series X|S generation)
  const hasGen9Optimized = Array.isArray(optimized) && optimized.includes("ConsoleGen9");
  const hasGen9Compatible = Array.isArray(compatible) && compatible.includes("ConsoleGen9");

  // Check 3: availableOn markers from store provider
  const hasSeriesXInAvailableOn =
    platforms.includes("XboxSeriesX") || platforms.includes("XboxSeriesS");

  // Check 4: PC-only rejection
  const isPCOnly =
    platforms.length > 0 &&
    platforms.every((p) => p === "PC" || p === "Handheld") &&
    !hasGen9Optimized &&
    !hasGen9Compatible;

  if (isPCOnly) {
    return {
      isQualified: false,
      reason: "REJECTED_PC_ONLY",
      platforms,
      isCrossGen: false,
    };
  }

  // Check 5: Xbox One-only rejection (no Series X|S support)
  const isXboxOneOnly =
    platforms.length > 0 &&
    platforms.includes("XboxOne") &&
    !hasSeriesXInAvailableOn &&
    !hasGen9Optimized &&
    !hasGen9Compatible &&
    !input.parentIsSeriesCompatible;

  if (isXboxOneOnly) {
    return {
      isQualified: false,
      reason: "REJECTED_XBOX_ONE_ONLY",
      platforms,
      isCrossGen: false,
    };
  }

  // Check 6: Series X|S qualification (native Series X|S, cross-gen, or qualified parent)
  const isDirectSeriesX = hasGen9Optimized || hasGen9Compatible || hasSeriesXInAvailableOn;
  const isQualified = isDirectSeriesX || Boolean(input.parentIsSeriesCompatible);

  if (isQualified) {
    const isCrossGen =
      (platforms.includes("XboxOne") && platforms.includes("XboxSeriesX")) ||
      (Array.isArray(optimized) && optimized.includes("ConsoleGen8") && optimized.includes("ConsoleGen9"));

    return {
      isQualified: true,
      reason: "QUALIFIED_SERIES_XS",
      platforms: platforms.length > 0 ? platforms : ["XboxSeriesX"],
      isCrossGen,
    };
  }

  return {
    isQualified: false,
    reason: "REJECTED_NOT_SERIES_COMPATIBLE",
    platforms,
    isCrossGen: false,
  };
}
