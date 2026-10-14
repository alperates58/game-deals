import { prisma } from "../lib/db/prisma";

async function main() {
  const bundle = await prisma.game.findFirst({
    where: { productClass: "BUNDLE", parentRelations: { some: {} } },
    select: { slug: true, title: true },
  });

  const baseGame = await prisma.game.findFirst({
    where: {
      productClass: "BASE_GAME",
      parentRelations: {
        some: {
          relationType: { in: ["DLC_OF", "ADDON_OF", "EXPANSION_OF", "SEASON_PASS_OF"] },
        },
      },
    },
    select: { slug: true, title: true },
  });

  const dlc = await prisma.game.findFirst({
    where: {
      childRelations: {
        some: {
          relationType: { in: ["DLC_OF", "ADDON_OF", "EXPANSION_OF", "SEASON_PASS_OF"] },
        },
      },
    },
    select: { slug: true, title: true, productClass: true },
  });

  // Specifically check for Metro Saga Bundle as well
  const metroBundle = await prisma.game.findFirst({
    where: { title: { contains: "Metro Saga" } },
    select: { slug: true, title: true },
  });

  console.log(
    JSON.stringify({ bundle, baseGame, dlc, metroBundle }, null, 2)
  );
  await prisma.$disconnect();
}

main().catch(console.error);
