import { prisma } from "../lib/db/prisma";
import { XboxCatalogClient } from "../lib/xbox/catalog-client";

async function main() {
  const unknowns = await prisma.game.findMany({
    where: { productClass: "UNKNOWN" },
    select: { id: true, xboxProductId: true },
  });

  console.log(`Found ${unknowns.length} UNKNOWN products to classify...`);
  if (unknowns.length === 0) return;

  const client = new XboxCatalogClient();
  const products = await client.fetchAllInBatches(
    unknowns.map((u) => u.xboxProductId),
    (proc, tot) => console.log(`Progress: ${proc}/${tot}...`)
  );

  const productMap = new Map(products.map((p) => [p.productId, p]));

  for (const u of unknowns) {
    const p = productMap.get(u.xboxProductId);
    if (!p) continue;

    await prisma.game.update({
      where: { id: u.id },
      data: {
        productClass: p.productClass,
        developer: p.developer,
        shortDescription: p.shortDescription,
        longDescription: p.longDescription,
        releaseDate: p.releaseDate,
        genres: p.genres,
        capabilities: p.capabilities,
        screenshots: p.screenshots,
      },
    });
  }

  const counts = await prisma.game.groupBy({
    by: ["productClass"],
    _count: true,
  });

  console.log("Updated classifications:", counts);
  await prisma.$disconnect();
}

main().catch(console.error);
