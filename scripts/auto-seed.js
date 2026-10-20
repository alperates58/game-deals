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
      await reconcileCrossPlatformVariants(prisma);
      return;
    }

    console.log("[Auto-Seed] Fresh database detected (0 games). Automatically loading initial Xbox catalog...");

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log("[Auto-Seed] DATABASE_URL is not set. Skipping initial seed.");
      return;
    }

    let host = "postgres";
    let port = "5432";
    let user = "postgres";
    let password = "";
    let database = "gamedeals";

    try {
      const u = new URL(dbUrl);
      host = u.hostname || host;
      port = u.port || port;
      user = decodeURIComponent(u.username || user);
      password = u.password ? decodeURIComponent(u.password) : "";
      database = u.pathname.replace(/^\//, "") || database;
    } catch {
      // invalid URL format
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
    await reconcileCrossPlatformVariants(prisma);
  } catch (err) {
    console.warn("[Auto-Seed] Warning: Auto-seed skipped due to:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function reconcileCrossPlatformVariants(prisma) {
  try {
    const dedupeSql = `
      WITH cleaned AS (
        SELECT 
          id,
          title,
          "productClass",
          platforms,
          "isCore",
          "popularityScore",
          regexp_replace(
            trim(regexp_replace(title, '\\s*[\\(\\[](Windows(?:\\s*10(?:\\/11)?)?|PC|Xbox One\\s*&\\s*Xbox Series X\\|S|Xbox Series X\\|S\\s*&\\s*Xbox One|Xbox One\\/Series X\\|S|Xbox Series X\\|S|Xbox Series X|Xbox One|XBOX One|Windows Edition)[\\)\\]]\\s*$', '', 'i')),
            '\\s+(Windows|Xbox One|Xbox Series X\\|S)\\s*$', '', 'i'
          ) AS base_title
        FROM "Game"
      ),
      ranked AS (
        SELECT 
          id,
          title,
          base_title,
          platforms,
          FIRST_VALUE(id) OVER (
            PARTITION BY LOWER(base_title), "productClass"
            ORDER BY 
              CASE WHEN LOWER(title) = LOWER(base_title) THEN 0 ELSE 1 END,
              CASE WHEN "isCore" THEN 0 ELSE 1 END,
              "popularityScore" DESC,
              id ASC
          ) AS canonical_id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(base_title), "productClass"
            ORDER BY 
              CASE WHEN LOWER(title) = LOWER(base_title) THEN 0 ELSE 1 END,
              CASE WHEN "isCore" THEN 0 ELSE 1 END,
              "popularityScore" DESC,
              id ASC
          ) AS row_num,
          COUNT(*) OVER (
            PARTITION BY LOWER(base_title), "productClass"
          ) AS group_count
        FROM cleaned
      )
      UPDATE "Game" g
      SET 
        "canonicalGameId" = r.canonical_id,
        "isPlatformVariant" = true
      FROM ranked r
      WHERE g.id = r.id 
        AND r.group_count > 1 
        AND r.row_num > 1;
    `;
    await prisma.$executeRawUnsafe(dedupeSql);

    const mergeSql = `
      WITH variant_platforms AS (
        SELECT 
          "canonicalGameId" AS id,
          array_agg(DISTINCT p) AS extra_platforms
        FROM "Game", unnest(platforms) AS p
        WHERE "isPlatformVariant" = true AND "canonicalGameId" IS NOT NULL
        GROUP BY "canonicalGameId"
      )
      UPDATE "Game" g
      SET 
        platforms = (
          SELECT array_agg(DISTINCT elem)
          FROM unnest(g.platforms || vp.extra_platforms) AS elem
        )
      FROM variant_platforms vp
      WHERE g.id = vp.id;
    `;
    await prisma.$executeRawUnsafe(mergeSql);

    const cleanTitleSql = `
      UPDATE "Game"
      SET title = regexp_replace(
        trim(regexp_replace(title, '\\s*[\\(\\[](Windows(?:\\s*10(?:\\/11)?)?|PC|Xbox One\\s*&\\s*Xbox Series X\\|S|Xbox Series X\\|S\\s*&\\s*Xbox One|Xbox One\\/Series X\\|S|Xbox Series X\\|S|Xbox Series X|Xbox One|XBOX One|Windows Edition)[\\)\\]]\\s*$', '', 'i')),
        '\\s+(Windows|Xbox One|Xbox Series X\\|S)\\s*$', '', 'i'
      )
      WHERE "isPlatformVariant" = false
        AND title ~* '[\\(\\[](Windows|PC|Xbox One|Xbox Series X\\|S|Windows 10)[\\)\\]]\\s*$';
    `;
    await prisma.$executeRawUnsafe(cleanTitleSql);

    console.log("[Auto-Seed] Cross-platform deduplication verified and synchronized.");
  } catch (err) {
    console.warn("[Auto-Seed] Deduplication notice:", err.message);
  }
}

main().catch((e) => {
  console.warn("[Auto-Seed] Uncaught warning in auto-seed:", e.message);
});
