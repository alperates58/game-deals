import { XboxProductRaw } from "./schemas";
import { NormalizedXboxProduct } from "./types";
import { generateSlug } from "../pricing/slug";

export function mapDisplayCatalogProduct(raw: XboxProductRaw): NormalizedXboxProduct | null {
  const loc = raw.LocalizedProperties?.[0];
  const title = loc?.ProductTitle || "İsimsiz Oyun";
  const slug = generateSlug(title);
  const publisher = loc?.PublisherName || "Bilinmiyor";

  // Find poster or primary image
  const posterImg = loc?.Images?.find((img) => img.ImagePurpose === "Poster")?.Uri;
  const boxArtImg = loc?.Images?.find((img) => img.ImagePurpose === "BoxArt")?.Uri;
  const heroImg = loc?.Images?.find((img) => img.ImagePurpose === "TitledHeroArt")?.Uri;
  const rawImageUri = posterImg || boxArtImg || heroImg;

  let imageUrl: string | undefined = undefined;
  if (rawImageUri) {
    imageUrl = rawImageUri.startsWith("//") ? `https:${rawImageUri}` : rawImageUri;
  }

  // Iterate DisplaySkuAvailabilities to find the authoritative Purchase availability in TRY
  let purchaseAvailability: any = null;

  for (const dsa of raw.DisplaySkuAvailabilities || []) {
    for (const avail of dsa.Availabilities || []) {
      const isPurchase = avail.Actions?.includes("Purchase");
      const currency = avail.OrderManagementData?.Price?.CurrencyCode;

      if (isPurchase && currency === "TRY") {
        purchaseAvailability = avail;
        break;
      }
    }
    if (purchaseAvailability) break;
  }

  // If no TRY purchase availability found, check if it's a 0 TRY or free item or fallback
  if (!purchaseAvailability) {
    for (const dsa of raw.DisplaySkuAvailabilities || []) {
      for (const avail of dsa.Availabilities || []) {
        if (avail.OrderManagementData?.Price?.CurrencyCode === "TRY") {
          purchaseAvailability = avail;
          break;
        }
      }
      if (purchaseAvailability) break;
    }
  }

  if (!purchaseAvailability) {
    return null;
  }

  const priceObj = purchaseAvailability.OrderManagementData?.Price;
  const rawCurrent = priceObj?.ListPrice ?? 0;
  const rawMSRP = priceObj?.MSRP ?? rawCurrent;

  const currentPrice = Number(rawCurrent.toFixed(2));
  const listPrice = Number(rawMSRP.toFixed(2));
  const currency = priceObj?.CurrencyCode || "TRY";

  const isFree = currentPrice === 0 && listPrice === 0;
  const isOnSale = listPrice > currentPrice && currentPrice > 0;

  let discountPercent = 0;
  if (isOnSale && listPrice > 0) {
    discountPercent = Math.round(((listPrice - currentPrice) / listPrice) * 100);
  }

  // Conditions & platforms
  const conditions = purchaseAvailability.Conditions;
  let saleStartAt: Date | null = null;
  let saleEndAt: Date | null = null;

  if (conditions?.StartDate) {
    saleStartAt = new Date(conditions.StartDate);
  }
  if (conditions?.EndDate) {
    // Check if not year 9998
    const end = new Date(conditions.EndDate);
    if (end.getFullYear() < 9000) {
      saleEndAt = end;
    }
  }

  const platforms: string[] = [];
  const allowedPlatforms = conditions?.ClientConditions?.AllowedPlatforms;
  if (allowedPlatforms && Array.isArray(allowedPlatforms)) {
    for (const p of allowedPlatforms) {
      if (p.PlatformName === "Windows.Xbox" && !platforms.includes("Xbox")) {
        platforms.push("Xbox");
      } else if (p.PlatformName === "Windows.Desktop" && !platforms.includes("PC")) {
        platforms.push("PC");
      }
    }
  }
  if (platforms.length === 0) {
    platforms.push("Xbox");
  }

  const storeUrl = `https://www.xbox.com/tr-tr/games/store/${slug}/${raw.ProductId.toLowerCase()}`;

  return {
    productId: raw.ProductId.toUpperCase(),
    title,
    normalizedTitle: title.toLowerCase(),
    slug,
    publisher,
    productType: raw.ProductType || "Game",
    imageUrl,
    storeUrl,
    listPrice,
    currentPrice,
    currency,
    discountPercent,
    isOnSale,
    saleStartAt,
    saleEndAt,
    platforms,
    isFree,
    source: "MICROSOFT_DISPLAY_CATALOG",
  };
}
