import fs from 'node:fs';

async function testApi() {
  console.log('Testing Display Catalog with batch of popular titles...');
  
  // Test bigIds batching with 5 known big IDs
  const bigIds = [
    '9NXFX68ZNKK0', // GTA V PC
    'BX3M8L83BBRW', // Cyberpunk 2077
    '9NNZSNHLR63L', // GTA VI
    '9P7QDS4SVW0X', // Far Cry 6
    'BT5P2X999VH2', // Fortnite (free)
  ];

  const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${bigIds.join(',')}&market=TR&languages=tr-TR`;
  const start = Date.now();
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const duration = Date.now() - start;

  console.log(`HTTP Status: ${res.status} ${res.statusText} in ${duration}ms`);
  
  // Check headers for rate limiting
  console.log('--- Response Headers ---');
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase().includes('rate') || k.toLowerCase().includes('limit') || k.toLowerCase().includes('retry')) {
      console.log(`Header: ${k}: ${v}`);
    }
  }

  const json = await res.json();
  console.log(`Products returned count: ${json.Products?.length}`);

  // Create evidence folder if not exists
  fs.mkdirSync('docs/evidence/faz0', { recursive: true });

  const summary = [];

  for (const product of (json.Products || [])) {
    const loc = product.LocalizedProperties?.[0];
    const item = {
      productId: product.ProductId,
      title: loc?.ProductTitle,
      publisher: loc?.PublisherName,
      productType: product.ProductType,
      isFree: false,
      listPrice: null,
      currentPrice: null,
      currency: null,
      isOnSale: false,
      saleStartDate: null,
      saleEndDate: null,
      allowedPlatforms: [],
      purchaseAvailabilityId: null,
      posterImage: loc?.Images?.find(img => img.ImagePurpose === 'Poster')?.Uri || null,
      boxArtImage: loc?.Images?.find(img => img.ImagePurpose === 'BoxArt')?.Uri || null
    };

    // Locate purchase availability
    for (const dsa of (product.DisplaySkuAvailabilities || [])) {
      for (const avail of (dsa.Availabilities || [])) {
        const isPurchase = avail.Actions?.includes('Purchase');
        const price = avail.OrderManagementData?.Price;

        if (isPurchase && price?.CurrencyCode === 'TRY') {
          item.purchaseAvailabilityId = avail.AvailabilityId;
          item.currency = price.CurrencyCode;
          item.currentPrice = price.ListPrice;
          item.listPrice = price.MSRP ?? price.ListPrice;
          item.isFree = price.ListPrice === 0 && price.MSRP === 0;
          
          if (price.MSRP && price.ListPrice < price.MSRP) {
            item.isOnSale = true;
          }

          if (avail.Conditions?.StartDate) {
            item.saleStartDate = avail.Conditions.StartDate;
          }
          if (avail.Conditions?.EndDate) {
            item.saleEndDate = avail.Conditions.EndDate;
          }

          if (avail.Conditions?.ClientConditions?.AllowedPlatforms) {
            item.allowedPlatforms = avail.Conditions.ClientConditions.AllowedPlatforms.map(p => p.PlatformName);
          }
          break;
        }
      }
      if (item.purchaseAvailabilityId) break;
    }

    summary.push(item);
  }

  console.log('--- Extracted Normalized Products ---');
  console.table(summary.map(s => ({
    id: s.productId,
    title: s.title?.slice(0, 30),
    type: s.productType,
    cur: s.currency,
    currentPrice: s.currentPrice,
    listPrice: s.listPrice,
    isOnSale: s.isOnSale,
    isFree: s.isFree,
    platforms: s.allowedPlatforms.join(', ')
  })));

  // Write evidence
  fs.writeFileSync('docs/evidence/faz0/batch-test-result.json', JSON.stringify({
    status: res.status,
    durationMs: duration,
    requestUrl: url,
    productsCount: json.Products?.length,
    headers: Object.fromEntries(res.headers.entries())
  }, null, 2));

  fs.writeFileSync('docs/evidence/faz0/price-field-verification.json', JSON.stringify(summary, null, 2));
  fs.writeFileSync('docs/evidence/faz0/response-shape-summary.json', JSON.stringify({
    productKeys: Object.keys(json.Products?.[0] || {}),
    skuKeys: Object.keys(json.Products?.[0]?.DisplaySkuAvailabilities?.[0]?.Sku || {}),
    availabilityKeys: Object.keys(json.Products?.[0]?.DisplaySkuAvailabilities?.[0]?.Availabilities?.[0] || {}),
    priceKeys: Object.keys(json.Products?.[0]?.DisplaySkuAvailabilities?.[0]?.Availabilities?.[0]?.OrderManagementData?.Price || {})
  }, null, 2));

  console.log('Phase 0 evidence files successfully written to docs/evidence/faz0/');
}

testApi().catch(console.error);
