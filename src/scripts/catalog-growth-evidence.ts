import { prisma } from "../lib/db/prisma";
import fs from "node:fs";

async function main() {
  const totalGames = await prisma.game.count();
  const totalPrices = await prisma.priceHistory.count();
  const totalAnalyses = await prisma.dealAnalysis.count();
  const totalRelations = await prisma.gameRelation.count();

  const classCounts = await prisma.game.groupBy({
    by: ["productClass"],
    _count: true,
  });

  const relationCounts = await prisma.gameRelation.groupBy({
    by: ["relationType"],
    _count: true,
  });

  const isCoreCounts = await prisma.game.groupBy({
    by: ["isCore"],
    _count: true,
  });

  const syncRuns = await prisma.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  const evidence = {
    verifiedAt: new Date().toISOString(),
    totalGames,
    totalPrices,
    totalAnalyses,
    totalRelations,
    productClassDistribution: classCounts.reduce((acc, c) => {
      acc[c.productClass] = c._count;
      return acc;
    }, {} as Record<string, number>),
    relationTypeDistribution: relationCounts.reduce((acc, r) => {
      acc[r.relationType] = r._count;
      return acc;
    }, {} as Record<string, number>),
    isCoreDistribution: isCoreCounts.reduce((acc, c) => {
      acc[c.isCore ? "core" : "nonCore"] = c._count;
      return acc;
    }, {} as Record<string, number>),
    recentSyncRuns: syncRuns.map((s) => ({
      type: s.type,
      status: s.status,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      productsChecked: s.productsChecked,
      productsAdded: s.productsAdded,
      pricesChanged: s.pricesChanged,
    })),
    growthVerification: {
      initialTarget: 1051,
      relatedDiscovered: 568,
      calculatedTotal: 1051 + 568,
      actualTotalInDb: totalGames,
      isVerifiedExact: totalGames === 1051 + 568,
    },
  };

  fs.mkdirSync("docs/evidence/faz1.2", { recursive: true });
  fs.writeFileSync(
    "docs/evidence/faz1.2/catalog-sanity-check.json",
    JSON.stringify(evidence, null, 2)
  );

  console.log("=== CATALOG SANITY CHECK RESULT ===");
  console.log(JSON.stringify(evidence, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
