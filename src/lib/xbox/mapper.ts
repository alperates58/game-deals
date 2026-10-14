import { XboxProductRaw } from "./schemas";
import { NormalizedXboxProduct, ProductClass } from "./types";
import { generateSlug } from "../pricing/slug";

export function determineProductClass(
  title: string,
  productType: string,
  isBundle = false,
  hasBundledSkus = false,
  hasAddonParent = false
): ProductClass {
  const t = title.toLowerCase();

  // 1. Currency & Consumable
  if (
    productType.toLowerCase() === "consumable" ||
    t.includes("para kartı") ||
    t.includes("shark kartı") ||
    t.includes("sanal para") ||
    t.includes("currency") ||
    t.includes("points") ||
    t.includes("coin")
  ) {
    return "CURRENCY";
  }

  // 2. Bundles
  if (
    isBundle ||
    hasBundledSkus ||
    t.includes("bundle") ||
    t.includes("koleksiyonu") ||
    t.includes("collection") ||
    (t.includes("paketi") && t.includes("+")) ||
    t.includes("trilogy") ||
    t.includes("saga")
  ) {
    return "BUNDLE";
  }

  // 3. Add-on sub-types
  if (t.includes("season pass") || t.includes("sezon bileti")) {
    return "SEASON_PASS";
  }
  if (t.includes("expansion") || t.includes("genişletme")) {
    return "EXPANSION";
  }
  if (t.includes("dlc")) {
    return "DLC";
  }
  if (
    t.includes("pack") ||
    t.includes("paketi") ||
    t.includes("set") ||
    t.includes("upgrade") ||
    t.includes("yükseltme") ||
    t.includes("outfit") ||
    t.includes("skin")
  ) {
    return "CONTENT_PACK";
  }

  // 4. Other Durable / AddOn items or items with an addOnParent
  if (productType === "Durable" || productType.toLowerCase() === "addon" || hasAddonParent) {
    return "ADD_ON";
  }

  // Default to Base Game
  return "BASE_GAME";
}

export function mapDisplayCatalogProduct(raw: XboxProductRaw): NormalizedXboxProduct | null {
  const loc = raw.LocalizedProperties?.[0];
  const title = loc?.ProductTitle || "İsimsiz Oyun";
  const slug = generateSlug(title);
  const publisher = loc?.PublisherName || "Bilinmiyor";
  const developer = loc?.DeveloperName || undefined;

  // Find images
  const posterImg = loc?.Images?.find((img) => img.ImagePurpose === "Poster")?.Uri;
  const boxArtImg = loc?.Images?.find((img) => img.ImagePurpose === "BoxArt")?.Uri;
  const heroImg = loc?.Images?.find((img) => img.ImagePurpose === "TitledHeroArt")?.Uri;
  const rawImageUri = posterImg || boxArtImg || heroImg;

  let imageUrl: string | undefined = undefined;
  if (rawImageUri) {
    imageUrl = rawImageUri.startsWith("//") ? `https:${rawImageUri}` : rawImageUri;
  }

  // Screenshots
  const screenshots: string[] = [];
  if (loc?.Images) {
    for (const img of loc.Images) {
      if (img.ImagePurpose === "Screenshot" && img.Uri) {
        const fullUri = img.Uri.startsWith("//") ? `https:${img.Uri}` : img.Uri;
        screenshots.push(fullUri);
      }
    }
  }

  // Find authoritative purchase availability in TRY
  let purchaseAvailability: any = null;
  let skuWithBundles: any = null;

  for (const dsa of raw.DisplaySkuAvailabilities || []) {
    const sku = dsa.Sku;
    if (sku?.Properties?.BundledSkus && sku.Properties.BundledSkus.length > 0) {
      skuWithBundles = sku;
    }

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

  // Fallback availability
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

  // Authoritative Bundled child IDs
  const bundledProductIds: string[] = [];
  const rawBundledSkus = skuWithBundles?.Properties?.BundledSkus;
  if (Array.isArray(rawBundledSkus)) {
    for (const item of rawBundledSkus) {
      if (item.BigId) {
        bundledProductIds.push(item.BigId.toUpperCase());
      }
    }
  }

  // Authoritative addOnParent ID
  let parentProductId: string | undefined = undefined;
  const marketProp = raw.MarketProperties?.[0];
  if (marketProp?.RelatedProducts && Array.isArray(marketProp.RelatedProducts)) {
    const parentRel = marketProp.RelatedProducts.find(
      (r) => r.RelationshipType === "addOnParent"
    );
    if (parentRel?.RelatedProductId) {
      parentProductId = parentRel.RelatedProductId.toUpperCase();
    }
  }

  // Determine ProductClass
  const isBundle = Boolean(skuWithBundles?.Properties?.IsBundle);
  const productClass = determineProductClass(
    title,
    raw.ProductType || "Game",
    isBundle,
    bundledProductIds.length > 0,
    Boolean(parentProductId)
  );

  // Metadata: descriptions, release date, genres, capabilities
  const shortDescription = loc?.ShortDescription?.trim() || undefined;
  const longDescription = loc?.ProductDescription?.trim() || undefined;

  let releaseDate: Date | null = null;
  const rawRelease =
    marketProp?.OriginalReleaseDate ||
    marketProp?.ReleaseDate ||
    raw.Properties?.OriginalReleaseDate;
  if (rawRelease) {
    const parsed = new Date(rawRelease);
    if (!isNaN(parsed.getTime())) releaseDate = parsed;
  }

  const genres: string[] = [];
  if (raw.Properties?.Categories && Array.isArray(raw.Properties.Categories)) {
    genres.push(...raw.Properties.Categories);
  } else if (raw.Properties?.Category) {
    genres.push(raw.Properties.Category);
  }

  const capabilities: string[] = [];
  if (raw.Properties?.Attributes && Array.isArray(raw.Properties.Attributes)) {
    for (const a of raw.Properties.Attributes) {
      if (a.Name && !capabilities.includes(a.Name)) {
        capabilities.push(a.Name);
      }
    }
  }

  const storeUrl = `https://www.xbox.com/tr-tr/games/store/${slug}/${raw.ProductId.toLowerCase()}`;

  return {
    productId: raw.ProductId.toUpperCase(),
    title,
    normalizedTitle: title.toLowerCase(),
    slug,
    publisher,
    developer,
    productType: raw.ProductType || "Game",
    productClass,
    imageUrl,
    storeUrl,
    shortDescription,
    longDescription,
    releaseDate,
    genres,
    capabilities,
    screenshots,
    listPrice,
    currentPrice,
    currency,
    discountPercent,
    isOnSale,
    saleStartAt,
    saleEndAt,
    platforms,
    isFree,
    bundledProductIds,
    parentProductId,
    source: "MICROSOFT_DISPLAY_CATALOG",
  };
}
