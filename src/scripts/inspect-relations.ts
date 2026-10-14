import { prisma } from "../lib/db/prisma";

async function main() {
  const rels = await prisma.gameRelation.findMany({
    take: 10,
    include: {
      parentGame: { select: { title: true, productClass: true, slug: true } },
      childGame: { select: { title: true, productClass: true, slug: true } },
    },
  });
  console.log("Sample relations:", JSON.stringify(rels, null, 2));

  const relTypes = await prisma.gameRelation.groupBy({
    by: ["relationType"],
    _count: true,
  });
  console.log("Relation types count:", relTypes);
  await prisma.$disconnect();
}

main().catch(console.error);
