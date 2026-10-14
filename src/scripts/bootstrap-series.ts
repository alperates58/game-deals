import fs from "fs";
import path from "path";
import { prisma } from "../lib/db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../lib/db/advisory-lock";
import { FullCatalogBootstrap, BootstrapProgress } from "../lib/xbox/full-catalog-bootstrap";

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { limitProducts?: number; maxPages?: number; batchSize?: number } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      options.limitProducts = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--max-pages" && args[i + 1]) {
      options.maxPages = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  console.log("==================================================");
  console.log("XBOX SERIES X|S FULL CATALOG BOOTSTRAP");
  console.log("==================================================");
  console.log(`Config: limit=${options.limitProducts || "ALL"}, maxPages=${options.maxPages || "ALL"}, batchSize=${options.batchSize || 25}`);

  const locked = await acquireAdvisoryLock();
  if (!locked) {
    console.error("Advisory lock could not be acquired. Another sync or bootstrap is already running.");
    process.exit(1);
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      type: "DISCOVERY",
      status: "RUNNING",
    },
  });

  try {
    const bootstrap = new FullCatalogBootstrap();
    let lastLogged = 0;

    const report = await bootstrap.execute({
      limitProducts: options.limitProducts,
      maxPages: options.maxPages,
      batchSize: options.batchSize,
      onProgress: (p: BootstrapProgress) => {
        if (p.pagesFetched !== lastLogged) {
          lastLogged = p.pagesFetched;
          console.log(
            `[Progress] Page ${p.pagesFetched} | Discovered: ${p.rawProductsDiscovered} | Saved: ${p.productsSaved} | Rejected: (Free=${p.rejectedFree}, PC=${p.rejectedPcOnly}, XB1=${p.rejectedXboxOneOnly})`
          );
        }
      },
    });

    // Update SyncRun record
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        productsFound: report.totalRawDiscovered,
        productsChecked: report.totalRawDiscovered,
        productsAdded: report.totalSaved,
        errorCount: report.http5xxCount,
      },
    });

    // Write Quality Report to docs/evidence
    const evidenceDir = path.resolve(process.cwd(), "docs/evidence/faz1.2");
    fs.mkdirSync(evidenceDir, { recursive: true });
    const reportPath = path.join(evidenceDir, "catalog-quality-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("==================================================");
    console.log("BOOTSTRAP COMPLETED SUCCESSFULLY");
    console.log("==================================================");
    console.log(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
    console.log(`Raw Discovered: ${report.totalRawDiscovered}`);
    console.log(`Series X|S Qualified & Saved: ${report.totalSaved}`);
    console.log(`Rejected (Free): ${report.rejectedFree}`);
    console.log(`Rejected (PC Only): ${report.rejectedPcOnly}`);
    console.log(`Rejected (Xbox One Only): ${report.rejectedXboxOneOnly}`);
    console.log(`Total Game Relations Created: ${report.totalRelationsCreated}`);
    console.log("Product Class Distribution:", report.productClassCounts);
    console.log(`Black Myth: Wukong Found: ${report.sanityVerification.blackMythWukongFound ? "YES (Verified)" : "NO"}`);
    if (report.sanityVerification.blackMythWukongDetails) {
      console.log("Black Myth: Wukong Details:", report.sanityVerification.blackMythWukongDetails);
    }
    console.log(`Evidence report saved to: ${reportPath}`);
  } catch (err: any) {
    console.error("Fatal error during bootstrap:", err);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorSummary: err.message,
      },
    });
    process.exit(1);
  } finally {
    await releaseAdvisoryLock();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled fatal exception:", err);
  process.exit(1);
});
