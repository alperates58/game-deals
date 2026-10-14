import { DealVerdictCode, DealAnalysisResult } from "../xbox/types";
import { calculateConfidence } from "./confidence";

export interface DealScoreInput {
  currentPrice: number;
  listPrice: number;
  historicalLow: number;
  firstSeenAt: Date;
  priceHistoryCount: number;
  saleHistoryCount: number; // how many times observed on sale
  recentPriceTrend?: number; // difference from 30 days ago (negative means dropping)
}

export function calculateDealScore(input: DealScoreInput): DealAnalysisResult {
  const {
    currentPrice,
    listPrice,
    historicalLow,
    firstSeenAt,
    priceHistoryCount,
    saleHistoryCount,
    recentPriceTrend = 0,
  } = input;

  const confidence = calculateConfidence(firstSeenAt);

  // 1. Historical Low Proximity (55% weight)
  // If current price is at or below historical low -> 100 points
  // If current price is at list price -> 0 points
  let lowProximityScore = 0;
  let historicalPosition = 1.0;

  if (currentPrice <= historicalLow) {
    lowProximityScore = 100;
    historicalPosition = 0.0;
  } else if (listPrice <= historicalLow || currentPrice >= listPrice) {
    lowProximityScore = 0;
    historicalPosition = 1.0;
  } else {
    // Current price is between historicalLow and listPrice
    const diffRange = listPrice - historicalLow;
    const distanceAboveLow = currentPrice - historicalLow;
    historicalPosition = Math.min(1.0, Math.max(0.0, distanceAboveLow / diffRange));
    lowProximityScore = Math.round((1 - historicalPosition) * 100);
  }

  // 2. Store Discount (20% weight)
  // Based on current discount percentage
  let storeDiscountScore = 0;
  let discountPercent = 0;
  if (listPrice > 0 && currentPrice < listPrice) {
    discountPercent = Math.round(((listPrice - currentPrice) / listPrice) * 100);
    // 80% discount gives 100 points, 50% gives 62.5 points
    storeDiscountScore = Math.min(100, Math.round(discountPercent * 1.25));
  }

  // 3. Sale Rarity (15% weight)
  // If game is rarely discounted, a sale is more valuable
  let saleRarityScore = 50; // default average
  let saleFrequency = 0;
  if (priceHistoryCount > 0) {
    saleFrequency = Math.min(1.0, saleHistoryCount / priceHistoryCount);
    // Lower sale frequency = higher rarity score
    saleRarityScore = Math.round((1 - saleFrequency) * 100);
  }

  // 4. Price Momentum (10% weight)
  // If price is lower than previous period (recentPriceTrend < 0), score is high
  let momentumScore = 50;
  if (recentPriceTrend < 0) {
    momentumScore = Math.min(100, 50 + Math.round(Math.abs(recentPriceTrend) * 2));
  } else if (recentPriceTrend > 0) {
    momentumScore = Math.max(0, 50 - Math.round(recentPriceTrend * 2));
  }

  // Weighted total
  const rawDealScore =
    lowProximityScore * 0.55 +
    storeDiscountScore * 0.2 +
    saleRarityScore * 0.15 +
    momentumScore * 0.1;

  const dealScore = Math.min(100, Math.max(0, Math.round(rawDealScore)));

  // Map to verdict
  let verdict: DealVerdictCode = "POOR";
  let verdictLabel = "Zayıf Fırsat";

  if (dealScore >= 90) {
    verdict = "EXCELLENT";
    verdictLabel = "🔥 Kaçırma";
  } else if (dealScore >= 80) {
    verdict = "VERY_GOOD";
    verdictLabel = "🟢 Çok İyi";
  } else if (dealScore >= 65) {
    verdict = "GOOD";
    verdictLabel = "🟡 İyi";
  } else if (dealScore >= 45) {
    verdict = "WAIT";
    verdictLabel = "🟠 Bekle";
  } else {
    verdict = "POOR";
    verdictLabel = "🔴 Zayıf Fırsat";
  }

  // Deterministic Turkish reason
  let reason = "";
  if (currentPrice <= historicalLow && discountPercent > 0) {
    reason = `Oyun şu anda takip başladığından beri görülen en düşük fiyatında (${currentPrice.toLocaleString("tr-TR")} TL, %${discountPercent} indirim). Kaçırılmayacak fırsat.`;
  } else if (historicalPosition <= 0.15 && discountPercent >= 50) {
    reason = `Tarihi dip seviyesine (%${Math.round(historicalPosition * 100)} yakınlık) çok yakın ve %${discountPercent} mağaza indirimi mevcut.`;
  } else if (discountPercent > 0 && historicalPosition > 0.5) {
    reason = `%${discountPercent} indirimde ancak daha önce ${historicalLow.toLocaleString("tr-TR")} TL seviyesine inmişti. İndirimin derinleşmesi beklenebilir.`;
  } else if (discountPercent > 0) {
    reason = `Mevcut %${discountPercent} indirim makul seviyede (${currentPrice.toLocaleString("tr-TR")} TL).`;
  } else {
    reason = `İndirim bulunmuyor, standart liste fiyatından satılıyor (${currentPrice.toLocaleString("tr-TR")} TL).`;
  }

  return {
    dealScore,
    confidenceScore: confidence.score,
    historicalPosition,
    saleFrequency,
    daysSinceBetterPrice: null,
    verdict,
    verdictLabel,
    reason,
  };
}
