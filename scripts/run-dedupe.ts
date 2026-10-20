import { prisma } from "../src/lib/db/prisma";
import { deduplicateCrossPlatformGames } from "../src/lib/xbox/platform-dedupe";

async function main() {
  console.log("Starting cross-platform deduplication...");
  const result = await deduplicateCrossPlatformGames(prisma);
  console.log(`Deduplication finished: Processed ${result.groupsProcessed} multi-platform groups, marked ${result.variantsMarked} platform variants.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error running deduplication:", err);
  process.exit(1);
});
