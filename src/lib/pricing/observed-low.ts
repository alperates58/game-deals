export interface ObservedLowResult {
  isNewLow: boolean;
  historicalLow: number;
  historicalLowAt: Date;
}

export function evaluateObservedLow(
  currentPrice: number,
  existingLow: number | null,
  existingLowAt: Date | null,
  observedAt: Date = new Date()
): ObservedLowResult {
  // If no previous low exists, current price is the initial low
  if (existingLow === null || existingLow === undefined || existingLow === 0) {
    return {
      isNewLow: true,
      historicalLow: currentPrice,
      historicalLowAt: observedAt,
    };
  }

  // If current price is strictly less than existing low
  if (currentPrice < existingLow && currentPrice > 0) {
    return {
      isNewLow: true,
      historicalLow: currentPrice,
      historicalLowAt: observedAt,
    };
  }

  // Otherwise keep existing low
  return {
    isNewLow: false,
    historicalLow: existingLow,
    historicalLowAt: existingLowAt || observedAt,
  };
}
