import { XboxProductRaw } from "./schemas";
import { NormalizedXboxProduct, ProductClass } from "./types";
import { generateSlug } from "../pricing/slug";

export const KNOWN_BUNDLE_CHILDREN: Record<string, string[]> = {
  // Mafia: Trilogy (9NKG0X1MGQTX) -> Mafia 1 (9NX36W49M2GH), Mafia 2 (9N000033SQDR), Mafia 3 (C2M493H501ZG)
  "9NKG0X1MGQTX": ["9NX36W49M2GH", "9N000033SQDR", "C2M493H501ZG"],
  // Grand Theft Auto: The Trilogy – The Definitive Edition (9MXMJFNZMVWD) -> GTA 3 (9N3QFH749NBW), Vice City (9PC16M34CB91), San Andreas (9P7RSGG6Z699)
  "9MXMJFNZMVWD": ["9N3QFH749NBW", "9PC16M34CB91", "9P7RSGG6Z699"],
};

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

  // Find authoritative purchase availability in TRY (select best deal if multiple availabilities exist)
  let purchaseAvailability: any = null;
  let bestDiscount = -1;
  let lowestPrice = Infinity;

  for (const dsa of raw.DisplaySkuAvailabilities || []) {
    for (const avail of dsa.Availabilities || []) {
      const isPurchase = avail.Actions?.includes("Purchase");
      const priceObj = avail.OrderManagementData?.Price;
      const currency = priceObj?.CurrencyCode;

      if (isPurchase && currency === "TRY" && typeof priceObj?.ListPrice === "number") {
        const cPrice = priceObj.ListPrice;
        const mPrice = priceObj.MSRP ?? cPrice;
        const disc = mPrice > cPrice && mPrice > 0 ? Math.round(((mPrice - cPrice) / mPrice) * 100) : 0;

        if (!purchaseAvailability || disc > bestDiscount || (disc === bestDiscount && cPrice < lowestPrice)) {
          purchaseAvailability = avail;
          bestDiscount = disc;
          lowestPrice = cPrice;
        }
      }
    }
  }

  // Fallback availability
  if (!purchaseAvailability) {
    for (const dsa of raw.DisplaySkuAvailabilities || []) {
      for (const avail of dsa.Availabilities || []) {
        const priceObj = avail.OrderManagementData?.Price;
        if (priceObj?.CurrencyCode === "TRY" && typeof priceObj?.ListPrice === "number") {
          const cPrice = priceObj.ListPrice;
          const mPrice = priceObj.MSRP ?? cPrice;
          const disc = mPrice > cPrice && mPrice > 0 ? Math.round(((mPrice - cPrice) / mPrice) * 100) : 0;

          if (!purchaseAvailability || disc > bestDiscount || (disc === bestDiscount && cPrice < lowestPrice)) {
            purchaseAvailability = avail;
            bestDiscount = disc;
            lowestPrice = cPrice;
          }
        }
      }
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

  // Authoritative console generation flags from Display Catalog
  const opt = (raw.Properties as any)?.XboxConsoleGenOptimized || [];
  const comp = (raw.Properties as any)?.XboxConsoleGenCompatible || [];
  if (Array.isArray(opt) && opt.includes("ConsoleGen9") || Array.isArray(comp) && comp.includes("ConsoleGen9")) {
    if (!platforms.includes("XboxSeriesX")) platforms.push("XboxSeriesX");
  }
  if (Array.isArray(opt) && opt.includes("ConsoleGen8") || Array.isArray(comp) && comp.includes("ConsoleGen8")) {
    if (!platforms.includes("XboxOne")) platforms.push("XboxOne");
  }

  if (platforms.length === 0) {
    platforms.push("Xbox");
  }

  // Authoritative Bundled child IDs (Aggregated across all SKUs, Properties & RelatedProducts)
  const bundledProductIdsSet = new Set<string>();
  let hasAnyBundleFlag = false;

  for (const dsa of raw.DisplaySkuAvailabilities || []) {
    const sku = dsa.Sku;
    if (sku?.Properties?.IsBundle) {
      hasAnyBundleFlag = true;
    }
    const rawBundledSkus = (sku?.Properties as any)?.BundledSkus || (sku?.Properties as any)?.BundledProducts;
    if (Array.isArray(rawBundledSkus)) {
      for (const item of rawBundledSkus) {
        const bid = (item.BigId || item.ProductId || item.ProductBigId || item.Id || (typeof item === "string" ? item : ""))?.toString().trim().toUpperCase();
        if (bid && bid.length === 12) {
          bundledProductIdsSet.add(bid);
        }
      }
    }
    const rawBundledIds = (sku?.Properties as any)?.BundledProductIds;
    if (Array.isArray(rawBundledIds)) {
      for (const item of rawBundledIds) {
        const bid = item?.toString().trim().toUpperCase();
        if (bid && bid.length === 12) {
          bundledProductIdsSet.add(bid);
        }
      }
    }
  }

  // Also check top-level Properties
  const rawProps = (raw as any)?.Properties;
  if (Array.isArray(rawProps?.BundledSkus)) {
    for (const item of rawProps.BundledSkus) {
      const bid = (item.BigId || item.ProductId || (typeof item === "string" ? item : ""))?.toString().trim().toUpperCase();
      if (bid && bid.length === 12) bundledProductIdsSet.add(bid);
    }
  }
  if (Array.isArray(rawProps?.BundledProductIds)) {
    for (const item of rawProps.BundledProductIds) {
      const bid = item?.toString().trim().toUpperCase();
      if (bid && bid.length === 12) bundledProductIdsSet.add(bid);
    }
  }

  // Note: MarketProperties RelatedProducts with relType 'Bundle' indicates parent bundles that contain this item,
  // not items contained within this item. Child items are strictly defined in Sku.Properties.BundledSkus.

  // Known curated bundle children registry (failsafe for major game collections)
  const knownKids = KNOWN_BUNDLE_CHILDREN[productId.toUpperCase()];
  if (knownKids && knownKids.length > 0) {
    hasAnyBundleFlag = true;
    for (const k of knownKids) {
      bundledProductIdsSet.add(k.toUpperCase());
    }
  }

  const bundledProductIds = Array.from(bundledProductIdsSet);

  // Authoritative addOnParent ID
  let parentProductId: string | undefined = undefined;
  if (marketProp?.RelatedProducts && Array.isArray(marketProp.RelatedProducts)) {
    const parentRel = marketProp.RelatedProducts.find(
      (r) => r.RelationshipType === "addOnParent"
    );
    if (parentRel?.RelatedProductId) {
      parentProductId = parentRel.RelatedProductId.toUpperCase();
    }
  }

  // Determine ProductClass
  const isBundle = hasAnyBundleFlag || bundledProductIds.length > 0;
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
