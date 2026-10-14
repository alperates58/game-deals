import { prisma } from "../lib/db/prisma";

async function main() {
  const gc = await prisma.game.count();
  const rc = await prisma.gameRelation.count();
  const classes = await prisma.game.groupBy({
    by: ["productClass"],
    _count: true,
  });
  console.log("Current status:", {
    totalGames: gc,
    totalRelations: rc,
    classCounts: classes,
  });
  await prisma.$disconnect();
}

main().catch(console.error);
