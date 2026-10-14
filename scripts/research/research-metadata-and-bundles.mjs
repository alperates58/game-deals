import fs from "node:fs";

async function runResearch() {
  console.log("=== PHASE 1.1 METADATA & BUNDLE RESEARCH ===");

  // 1. Detailed Metadata Research on 3 known titles
  const sampleIds = [
    "9NXFX68ZNKK0", // GTA V PC
    "BX3M8L83BBRW", // Cyberpunk 2077
    "C545JKTS21Q2", // RE7 Gold Edition
  ];

  const metaUrl = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${sampleIds.join(",")}&market=TR&languages=tr-TR`;
  const metaRes = await fetch(metaUrl);
  const metaJson = await metaRes.json();

  console.log("Display Catalog metadata products count:", metaJson.Products?.length);

  const metadataEvidence = [];

  for (const p of metaJson.Products || []) {
    const loc = p.LocalizedProperties?.[0] || {};
    const prop = p.Properties || {};
    const marketProp = p.MarketProperties?.[0] || {};

    const item = {
      productId: p.ProductId,
      title: loc.ProductTitle,
      publisher: loc.PublisherName,
      developer: loc.DeveloperName,
      shortDescription: loc.ShortDescription ? loc.ShortDescription.slice(0, 150) + "..." : null,
      hasLongDescription: Boolean(loc.ProductDescription),
      longDescriptionSample: loc.ProductDescription ? loc.ProductDescription.slice(0, 200) + "..." : null,
      releaseDate: marketProp.OriginalReleaseDate || marketProp.ReleaseDate || prop.OriginalReleaseDate || null,
      categories: prop.Categories || [prop.Category].filter(Boolean),
      attributes: prop.Attributes?.map(a => a.Name) || [],
      capabilities: prop.Capabilities || [],
      imagesCount: loc.Images?.length || 0,
      imagePurposes: [...new Set(loc.Images?.map(i => i.ImagePurpose))],
      screenshots: loc.Images?.filter(i => i.ImagePurpose === "Screenshot").slice(0, 5).map(i => i.Uri) || [],
      trailers: loc.Videos?.map(v => ({ title: v.VideoTitle, uri: v.Uri, purpose: v.VideoPurpose })) || [],
      ratings: p.MarketProperties?.[0]?.UsageData?.map(u => ({ rating: u.Rating, ratingId: u.RatingId })) || [],
      languages: loc.SupportedLanguages || loc.Markets || [],
    };
    metadataEvidence.push(item);
  }

  // 2. Search for Bundles on Microsoft Store TR
  const bundleQueries = [
    "Metro Saga Bundle",
    "Batman Arkham Collection",
    "BioShock The Collection",
    "Tomb Raider Definitive Survivor Trilogy",
  ];

  const bundleSearchResults = {};

  for (const q of bundleQueries) {
    console.log(`Searching store for bundle query: "${q}"...`);
    const searchUrl = `https://www.microsoft.com/tr-tr/store/search/games?q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await res.text();
      const matches = [...html.matchAll(/\/p\/[^\/]+\/([a-zA-Z0-9]{12})/g)];
      const ids = [...new Set(matches.map(m => m[1].toUpperCase()))];
      bundleSearchResults[q] = ids;
      console.log(`Found IDs for "${q}":`, ids.slice(0, 4));
    } catch (e) {
      console.error(`Error searching bundle "${q}":`, e.message);
    }
  }

  // Collect candidate bundle IDs
  const candidateBundleIds = [
    ...new Set(Object.values(bundleSearchResults).flat()),
  ].slice(0, 15);

  console.log(`\nQuerying Display Catalog for ${candidateBundleIds.length} candidate bundle IDs...`);
  const bundleCatalogUrl = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${candidateBundleIds.join(",")}&market=TR&languages=tr-TR`;
  const bundleRes = await fetch(bundleCatalogUrl);
  const bundleJson = await bundleRes.json();

  console.log(`Returned ${bundleJson.Products?.length} candidate bundle products.`);

  const bundleDeepAnalysis = [];

  for (const p of bundleJson.Products || []) {
    const title = p.LocalizedProperties?.[0]?.ProductTitle;
    const isBundleLikely =
      title?.toLowerCase().includes("bundle") ||
      title?.toLowerCase().includes("collection") ||
      title?.toLowerCase().includes("paket") ||
      title?.toLowerCase().includes("trilogy") ||
      title?.toLowerCase().includes("saga");

    const analysis = {
      productId: p.ProductId,
      title,
      productType: p.ProductType,
      productFamily: p.ProductFamily,
      isBundleLikely,
      keys: Object.keys(p),
      propertiesKeys: Object.keys(p.Properties || {}),
      // Look for any bundled child references across all fields
      bundledProductSkus: p.DisplaySkuAvailabilities?.map(d => ({
        skuId: d.Sku?.SkuId,
        skuType: d.Sku?.SkuType,
        bundledSkus: d.Sku?.Properties?.BundledSkus,
        bundledProductSkus: d.Sku?.Properties?.BundledProductSkus,
        packages: d.Sku?.Properties?.Packages,
        customProperties: d.Sku?.Properties,
      })),
      packageFamilyName: p.Properties?.PackageFamilyName,
      hasBundledItems: false,
      childProductsFound: [],
    };

    // Deep search in the entire JSON for any references to other product IDs or child packages
    const jsonStr = JSON.stringify(p);
    const idMatches = [...jsonStr.matchAll(/"ProductId"\s*:\s*"([9BCDFGHJKLMNPQRSTVWXZ0-9]{12})"/gi)];
    const otherProductIds = [...new Set(idMatches.map(m => m[1].toUpperCase()).filter(id => id !== p.ProductId))];
    if (otherProductIds.length > 0) {
      analysis.hasBundledItems = true;
      analysis.childProductsFound = otherProductIds;
    }

    bundleDeepAnalysis.push(analysis);
  }

  // Write Evidence Files
  fs.mkdirSync("docs/evidence/faz1.1", { recursive: true });

  fs.writeFileSync(
    "docs/evidence/faz1.1/metadata-fields-sample.json",
    JSON.stringify(metadataEvidence, null, 2)
  );

  fs.writeFileSync(
    "docs/evidence/faz1.1/bundle-search-results.json",
    JSON.stringify(bundleSearchResults, null, 2)
  );

  fs.writeFileSync(
    "docs/evidence/faz1.1/bundle-structure-analysis.json",
    JSON.stringify(bundleDeepAnalysis, null, 2)
  );

  console.log("Research script completed. Evidence written to docs/evidence/faz1.1/");
}

runResearch().catch(console.error);
