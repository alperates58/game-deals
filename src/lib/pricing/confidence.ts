import { ConfidenceScore } from "../xbox/types";

export interface ConfidenceDetails {
  score: ConfidenceScore;
  label: string;
  daysTracked: number;
  description: string;
}

export function calculateConfidence(firstSeenAt: Date, referenceDate: Date = new Date()): ConfidenceDetails {
  const diffTime = Math.abs(referenceDate.getTime() - firstSeenAt.getTime());
  const daysTracked = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysTracked < 15) {
    return {
      score: "LOW",
      label: "Yeni Takip",
      daysTracked,
      description: "Takip süresi henüz 14 günün altında. Fiyat dip noktası gelişmektedir.",
    };
  } else if (daysTracked < 60) {
    return {
      score: "MEDIUM",
      label: "Orta Güven",
      daysTracked,
      description: "1-2 aylık fiyat hareketleri gözlemlendi. Referans tabanı oturuyor.",
    };
  } else if (daysTracked < 180) {
    return {
      score: "HIGH",
      label: "Yüksek Güven",
      daysTracked,
      description: "Çeyrek yıllık indirim döngüleri kaydedildi. Karşılaştırma güvenilirdir.",
    };
  } else {
    return {
      score: "VERY_HIGH",
      label: "Çok Yüksek Güven",
      daysTracked,
      description: "6 aydan uzun sağlam veri geçmişi mevcuttur. Tarihi eğilimler doğrulanmıştır.",
    };
  }
}
