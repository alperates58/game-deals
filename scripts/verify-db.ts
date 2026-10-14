import { prisma } from "../src/lib/db/prisma";

async function verifyDb() {
  const total = await prisma.game.count();
  const coreCount = await prisma.game.count({ where: { isCore: true } });
  const onSaleCount = await prisma.game.count({ where: { discountPercent: { gt: 0 } } });
  const historyCount = await prisma.priceHistory.count();
  const analysisCount = await prisma.dealAnalysis.count();

  console.log(`=== DATABASE VERIFICATION ===`);
  console.log(`Total Games: ${total}`);
  console.log(`Core Games: ${coreCount}`);
  console.log(`Games On Sale: ${onSaleCount}`);
  console.log(`Total Price History Rows: ${historyCount}`);
  console.log(`Deal Analyses Computed: ${analysisCount}`);

  // Fetch sample products for acceptance report real data proof
  const samples = await prisma.game.findMany({
    where: { discountPercent: { gt: 0 } },
    include: { dealAnalysis: true },
    take: 5,
  });

  console.log(`\n=== REAL ON-SALE SAMPLES ===`);
  for (const s of samples) {
    console.log({
      id: s.xboxProductId,
      title: s.title,
      currentPrice: s.currentPrice.toNumber(),
      listPrice: s.listPrice.toNumber(),
      discount: `%${s.discountPercent}`,
      historicalLow: s.historicalLow.toNumber(),
      dealScore: s.dealAnalysis?.dealScore,
      verdict: s.dealAnalysis?.verdict,
    });
  }

  await prisma.$disconnect();
}

verifyDb().catch(console.error);
