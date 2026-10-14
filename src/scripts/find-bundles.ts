import { prisma } from "../lib/db/prisma";

async function main() {
  const bundlesWithChildren = await prisma.game.findMany({
    where: {
      parentRelations: {
        some: { relationType: "BUNDLE_CONTAINS" },
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      parentRelations: {
        where: { relationType: "BUNDLE_CONTAINS" },
        include: { childGame: { select: { title: true, currentPrice: true } } },
      },
    },
    take: 5,
  });

  console.log(
    "Bundles with BUNDLE_CONTAINS relations:",
    JSON.stringify(bundlesWithChildren, null, 2)
  );
  await prisma.$disconnect();
}

main().catch(console.error);
