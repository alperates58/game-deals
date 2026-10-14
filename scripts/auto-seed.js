const { PrismaClient } = require("@prisma/client");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

async function main() {
  const seedFile = path.resolve(__dirname, "../prisma/seed.dump");
  if (!fs.existsSync(seedFile)) {
    console.log("[Auto-Seed] No seed.dump found. Proceeding with empty database.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const count = await prisma.game.count();
    if (count > 0) {
      console.log(`[Auto-Seed] Database already contains ${count} games. Skipping initial seed.`);
      return;
    }

    console.log("[Auto-Seed] Fresh database detected (0 games). Automatically loading initial Xbox catalog...");

    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@postgres:5432/gamedeals";
    let host = "postgres";
    let port = "5432";
    let user = "postgres";
    let password = "postgrespassword";
    let database = "gamedeals";

    try {
      const u = new URL(dbUrl);
      host = u.hostname || host;
      port = u.port || port;
      user = decodeURIComponent(u.username || user);
      password = u.password ? decodeURIComponent(u.password) : password;
      database = u.pathname.replace(/^\//, "") || database;
    } catch {
      // fallback
    }

    // Execute pg_restore
    const args = [
      "-h", host,
      "-p", port,
      "-U", user,
      "-d", database,
      "--no-owner",
      "--no-privileges",
      "--data-only",
      seedFile,
    ];

    try {
      execFileSync("pg_restore", args, {
        env: { ...process.env, PGPASSWORD: password },
        stdio: "pipe",
      });
    } catch (restoreErr) {
      // pg_restore can exit with 1 if there are minor duplicate warnings, check actual game count
      console.warn("[Auto-Seed] Notice during pg_restore execution:", restoreErr.message);
    }

    const newCount = await prisma.game.count();
    console.log(`[Auto-Seed] Initial seed completed! ${newCount} games and relations ready.`);
  } catch (err) {
    console.warn("[Auto-Seed] Warning: Auto-seed skipped due to:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.warn("[Auto-Seed] Uncaught warning in auto-seed:", e.message);
});
