import fs from 'node:fs';

async function searchFranchise(franchise) {
  const url = `https://www.microsoft.com/tr-tr/store/search/games?q=${encodeURIComponent(franchise)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Matches like /p/game-name/9nx... or href="/tr-tr/p/.../([a-zA-Z0-9]{12})"
    const matches = [...text.matchAll(/\/p\/[^\/]+\/([a-zA-Z0-9]{12})/g)];
    const ids = [...new Set(matches.map(m => m[1].toUpperCase()))];
    return ids;
  } catch (err) {
    console.error(`Error searching ${franchise}:`, err.message);
    return [];
  }
}

async function testAll() {
  const testFranchises = ['Forza', 'Assassin\'s Creed', 'Witcher', 'Elden Ring', 'Resident Evil'];
  const allIds = new Set();
  for (const f of testFranchises) {
    const ids = await searchFranchise(f);
    console.log(`Franchise: "${f}" found ${ids.length} product IDs:`, ids.slice(0, 5));
    ids.forEach(id => allIds.add(id));
  }

  console.log(`Total unique IDs from test franchises: ${allIds.size}`);
  
  // Now verify these IDs against Display Catalog
  const sample = Array.from(allIds).slice(0, 15);
  const catalogUrl = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${sample.join(',')}&market=TR&languages=tr-TR`;
  const catRes = await fetch(catalogUrl);
  const catData = await catRes.json();
  console.log(`Display Catalog returned ${catData.Products?.length} valid products for ${sample.length} searched IDs.`);
  
  for (const p of (catData.Products || []).slice(0, 5)) {
    console.log(`- ${p.ProductId}: ${p.LocalizedProperties?.[0]?.ProductTitle} (${p.ProductType})`);
  }
}

testAll().catch(console.error);
