import { prisma } from "../src/lib/db/prisma";
import fs from "node:fs";

async function main() {
  const g = await prisma.game.count();
  const ph = await prisma.priceHistory.count();
  const da = await prisma.dealAnalysis.count();
  const sr = await prisma.syncRun.count();
  const counts = {
    timestamp: new Date().toISOString(),
    games: g,
    priceHistories: ph,
    dealAnalyses: da,
    syncRuns: sr,
  };
  console.log("DB Row Counts:", JSON.stringify(counts, null, 2));

  fs.mkdirSync("docs/evidence/faz1.1", { recursive: true });
  fs.writeFileSync(
    "docs/evidence/faz1.1/migration-baseline-counts.json",
    JSON.stringify(counts, null, 2)
  );
  await prisma.$disconnect();
}

main().catch(console.error);
