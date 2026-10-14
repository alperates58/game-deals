import { prisma } from "../../src/lib/db/prisma";

async function main() {
  const games = await prisma.game.findMany({
    where: {
      OR: [
        { title: { contains: "Bundle", mode: "insensitive" } },
        { title: { contains: "Collection", mode: "insensitive" } },
        { title: { contains: "Paket", mode: "insensitive" } },
        { title: { contains: "Saga", mode: "insensitive" } },
        { title: { contains: "Trilogy", mode: "insensitive" } },
        { title: { contains: "Pass", mode: "insensitive" } },
        { title: { contains: "DLC", mode: "insensitive" } },
        { title: { contains: "Expansion", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      xboxProductId: true,
      title: true,
      productType: true,
      currentPrice: true,
      listPrice: true,
    },
    take: 30,
  });

  console.log(`Found ${games.length} candidate bundle/addon games in local DB:`);
  for (const g of games) {
    console.log(`- [${g.xboxProductId}] "${g.title}" | Type: ${g.productType} | Price: ${g.currentPrice}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
