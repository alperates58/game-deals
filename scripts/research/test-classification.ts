import { prisma } from "../../src/lib/db/prisma";

export function classifyProduct(title: string, productType: string, isBundle?: boolean): string {
  const t = title.toLowerCase();

  // 1. Currency & Consumable
  if (
    productType.toLowerCase() === "consumable" ||
    t.includes("para kartı") ||
    t.includes("shark kartı") ||
    t.includes("sanal para") ||
    t.includes("currency") ||
    t.includes("points") ||
    t.includes("coin")
  ) {
    return "CURRENCY";
  }

  // 2. Bundle
  if (isBundle || t.includes("bundle") || t.includes("koleksiyonu") || t.includes("collection") || (t.includes("paketi") && t.includes("+"))) {
    return "BUNDLE";
  }

  // 3. Add-on subtypes
  if (t.includes("season pass") || t.includes("sezon bileti")) {
    return "SEASON_PASS";
  }
  if (t.includes("expansion") || t.includes("genişletme")) {
    return "EXPANSION";
  }
  if (t.includes("dlc")) {
    return "DLC";
  }
  if (t.includes("pack") || t.includes("paketi") || t.includes("set") || t.includes("upgrade") || t.includes("yükseltme")) {
    return "CONTENT_PACK";
  }

  // 4. Base game vs Durable
  if (productType === "Durable") {
    return "ADD_ON";
  }

  return "BASE_GAME";
}

async function testClassification() {
  const games = await prisma.game.findMany({
    select: { id: true, title: true, productType: true },
  });

  const counts: Record<string, number> = {};
  for (const g of games) {
    const cls = classifyProduct(g.title, g.productType);
    counts[cls] = (counts[cls] || 0) + 1;
  }

  console.log("Classification preview for 1051 products:", counts);
  await prisma.$disconnect();
}

testClassification().catch(console.error);
