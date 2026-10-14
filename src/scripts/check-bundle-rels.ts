import { prisma } from "../lib/db/prisma";

async function main() {
  const g = await prisma.game.findUnique({
    where: { slug: "cyberpunk-2077-ultimate-edition-xbox-series-xs" },
    include: {
      parentRelations: { include: { childGame: true } },
      childRelations: { include: { parentGame: true } },
    },
  });
  console.log("Cyberpunk ultimate:", {
    title: g?.title,
    productClass: g?.productClass,
    parentRels: g?.parentRelations.length,
    childRels: g?.childRelations.length,
    parentRelItems: g?.parentRelations.map((r) => ({
      type: r.relationType,
      child: r.childGame?.title,
    })),
  });

  const fc = await prisma.game.findUnique({
    where: { slug: "far-cry-6-yilin-oyunu-yukseltmesi-karti" },
    include: {
      parentRelations: { include: { childGame: true } },
    },
  });
  console.log("Far Cry 6 YOYK:", {
    title: fc?.title,
    productClass: fc?.productClass,
    parentRels: fc?.parentRelations.length,
    parentRelItems: fc?.parentRelations.map((r) => ({
      type: r.relationType,
      child: r.childGame?.title,
    })),
  });
  await prisma.$disconnect();
}

main().catch(console.error);
