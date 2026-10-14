import fs from "node:fs";

async function runResearch() {
  console.log("=== DISPLAY CATALOG DEEP METADATA & RELATIONSHIP RESEARCH ===");

  // Test set:
  // 1. Base Game: Grand Theft Auto V (9NXFX68ZNKK0), Far Cry 6 (9P3H4968GRSM or 9NNZSNHLR63L or Cyberpunk BX3M8L83BBRW)
  // 2. Bundles: BV4F07T1WH5T (Far Cry 4 + Primal), 9MXMJFNZMVWD (GTA Trilogy), 9PN0XVQXR2R6 (Far Cry 5 + New Dawn)
  // 3. DLCs: 9NPV7L06K0BB (FC6 DLC 2), 9NSXB5QB1L3T (FC6 DLC 1), C4JQP2HXZFGD (FC4 Season Pass), 9MWHGB7HR6TT (FH5 Welcome Pack), 9NSB7PDLFNFK (FH6 Genisletme)
  const testIds = [
    "9NXFX68ZNKK0", // GTA V PC
    "BX3M8L83BBRW", // Cyberpunk 2077
    "BV4F07T1WH5T", // FAR CRY 4 + FAR CRY PRIMAL PAKETİ
    "9MXMJFNZMVWD", // GTA Trilogy
    "9PN0XVQXR2R6", // Far Cry 5 + New Dawn Deluxe
    "9NPV7L06K0BB", // Far Cry 6 DLC 2 Pagan
    "9NSXB5QB1L3T", // Far Cry 6 DLC 1 Insanity
    "C4JQP2HXZFGD", // FAR CRY 4 SEASON PASS
    "9MWHGB7HR6TT", // Forza Horizon 5 Hoş Geldin Paketi
  ];

  const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${testIds.join(",")}&market=TR&languages=tr-TR`;
  const res = await fetch(url);
  const data = await res.json();
  const products = data.Products || [];

  console.log(`Retrieved ${products.length} products from Display Catalog.`);

  fs.mkdirSync("docs/evidence/faz1.1/addons", { recursive: true });

  const metadataReport = [];
  const bundleReport = [];
  const addonReport = [];

  for (const p of products) {
    const loc = p.LocalizedProperties?.[0] || {};
    const prop = p.Properties || {};
    const marketProp = p.MarketProperties?.[0] || {};

    const meta = {
      productId: p.ProductId,
      title: loc.ProductTitle,
      productType: p.ProductType,
      productFamily: p.ProductFamily,
      publisher: loc.PublisherName,
      developer: loc.DeveloperName,
      hasShortDesc: Boolean(loc.ShortDescription),
      shortDescPreview: loc.ShortDescription?.slice(0, 100),
      hasLongDesc: Boolean(loc.ProductDescription),
      longDescPreview: loc.ProductDescription?.slice(0, 150),
      releaseDate: marketProp.OriginalReleaseDate || marketProp.ReleaseDate || prop.OriginalReleaseDate || null,
      categories: prop.Categories || [prop.Category].filter(Boolean),
      attributes: prop.Attributes?.map((a) => a.Name) || [],
      capabilities: prop.Capabilities || [],
      platforms: p.DisplaySkuAvailabilities?.[0]?.Availabilities?.[0]?.Conditions?.ClientConditions?.AllowedPlatforms?.map((x) => x.PlatformName) || [],
      screenshotsCount: loc.Images?.filter((img) => img.ImagePurpose === "Screenshot")?.length || 0,
      screenshots: loc.Images?.filter((img) => img.ImagePurpose === "Screenshot").slice(0, 4).map((i) => i.Uri) || [],
      trailersCount: loc.Videos?.length || 0,
      trailers: loc.Videos || [],
      ratings: marketProp.UsageData || [],
      markets: loc.Markets || [],
      productGroupId: prop.ProductGroupId,
      productGroupName: prop.ProductGroupName,
      packageFamilyName: prop.PackageFamilyName,
    };
    metadataReport.push(meta);

    // Deep inspect Sku Properties & Bundled items
    for (const dsa of p.DisplaySkuAvailabilities || []) {
      const sku = dsa.Sku || {};
      const skuProp = sku.Properties || {};
      const avail = dsa.Availabilities?.[0] || {};

      const skuInfo = {
        productId: p.ProductId,
        title: loc.ProductTitle,
        skuId: sku.SkuId,
        skuType: sku.SkuType,
        skuPropertiesKeys: Object.keys(skuProp),
        bundledSkus: skuProp.BundledSkus,
        bundledProductSkus: skuProp.BundledProductSkus,
        packages: skuProp.Packages,
        availConditions: avail.Conditions,
        availActions: avail.Actions,
      };

      if (skuProp.BundledSkus || skuProp.BundledProductSkus || skuProp.Packages) {
        bundleReport.push(skuInfo);
      }
    }

    // Inspect add-on / relationship clues
    const relationClues = {
      productId: p.ProductId,
      title: loc.ProductTitle,
      productType: p.ProductType,
      productFamily: p.ProductFamily,
      productGroupId: prop.ProductGroupId,
      productGroupName: prop.ProductGroupName,
      packageFamilyName: prop.PackageFamilyName,
      merchandizingTags: p.MerchandizingTags,
      alternateIds: p.AlternateIds,
      allowedPlatforms: prop.Attributes,
      // Check all keys in Properties
      properties: prop,
    };
    addonReport.push(relationClues);
  }

  // Save full reports
  fs.writeFileSync("docs/evidence/faz1.1/metadata-fields-verified.json", JSON.stringify(metadataReport, null, 2));
  fs.writeFileSync("docs/evidence/faz1.1/bundle-sku-properties.json", JSON.stringify(bundleReport, null, 2));
  fs.writeFileSync("docs/evidence/faz1.1/addons/addon-properties-raw.json", JSON.stringify(addonReport, null, 2));

  console.log("Research data saved to docs/evidence/faz1.1/");
}

runResearch().catch(console.error);
