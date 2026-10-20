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
      await ensureSystemSettingsHealth(prisma);
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
    await ensureSystemSettingsHealth(prisma);
    await reconcileCrossPlatformVariants(prisma);
  } catch (err) {
    console.warn("[Auto-Seed] Warning: Auto-seed skipped due to:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureSystemSettingsHealth(prisma) {
  try {
    await prisma.systemSetting.updateMany({
      where: { id: "global", telegramNotificationsEnabled: false },
      data: { telegramNotificationsEnabled: true },
    });
  } catch (err) {
    // safe ignore
  }
}

async function reconcileUserNotifications(prisma) {
  try {
    const notifs = await prisma.userNotification.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        badges: true,
        linkUrl: true,
        readAt: true,
        createdAt: true,
      },
    });

    if (notifs.length === 0) return;

    const TITLE_PRIORITY = [
      "Tarihi Dip",
      "Mega İndirim",
      "Fırsat Skoru",
      "İstek Listesi",
      "Paket İndirimi",
      "Fiyat Alarmı",
      "Ücretsiz Oyun",
      "Favori",
    ];

    function getPriority(title) {
      const t = (title || "").toLowerCase();
      for (let i = 0; i < TITLE_PRIORITY.length; i++) {
        if (t.includes(TITLE_PRIORITY[i].toLowerCase())) return i;
      }
      return 999;
    }

    function extractBadges(item) {
      const badges = [...(item.badges || [])];
      const lowerTitle = (item.title || "").toLowerCase();
      const lowerMsg = (item.message || "").toLowerCase();

      if (lowerTitle.includes("tarihi dip") || lowerMsg.includes("tarihi dip")) badges.push("🎯 Tarihi Dip");
      if (lowerTitle.includes("mega") || lowerTitle.includes("%70") || lowerMsg.includes("%7") || lowerMsg.includes("%8") || lowerMsg.includes("%9")) badges.push("💥 Mega İndirim");
      if (lowerTitle.includes("fırsat skoru") || lowerMsg.includes("skor")) badges.push("⚡ Yüksek Fırsat");
      if (lowerTitle.includes("ücretsiz") || lowerMsg.includes("0 tl")) badges.push("🎁 Ücretsiz");
      if (lowerTitle.includes("istek")) badges.push("✨ İstek Listesi");
      if (lowerTitle.includes("dlc") || lowerTitle.includes("eklenti")) badges.push("📦 Eklenti");
      if (lowerTitle.includes("favori")) badges.push("❤️ Favori");
      return Array.from(new Set(badges));
    }

    const groups = new Map();
    for (const n of notifs) {
      const day = n.createdAt.toISOString().split("T")[0];
      const targetKey = n.linkUrl || n.message.replace(/şu an.*/i, "").trim().toLowerCase();
      const groupKey = `${n.userId}:::${targetKey}:::${day}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(n);
    }

    let deletedCount = 0;
    for (const [, items] of groups.entries()) {
      if (items.length <= 1) continue;

      items.sort((a, b) => {
        const pA = getPriority(a.title);
        const pB = getPriority(b.title);
        if (pA !== pB) return pA - pB;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const canonical = items[0];
      const duplicates = items.slice(1);

      const allBadges = new Set();
      for (const it of items) {
        for (const b of extractBadges(it)) allBadges.add(b);
      }

      const earliestReadAt = items.find((i) => Boolean(i.readAt))?.readAt || null;

      await prisma.userNotification.update({
        where: { id: canonical.id },
        data: {
          badges: Array.from(allBadges),
          readAt: earliestReadAt,
        },
      });

      const idsToDelete = duplicates.map((d) => d.id);
      await prisma.userNotification.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      deletedCount += idsToDelete.length;
    }

    if (deletedCount > 0) {
      console.log(`[Auto-Seed] Consolidated notifications, purged ${deletedCount} redundant duplicate rows.`);
    }
  } catch (err) {
    console.warn("[Auto-Seed] Notification deduplication warning:", err.message);
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
          CASE 
            WHEN "productClass" IN ('ADD_ON', 'CONTENT_PACK', 'CURRENCY', 'SEASON_PASS') THEN 'DLC'
            ELSE 'GAME'
          END AS product_group,
          trim(regexp_replace(
            regexp_replace(title, '\\s*(?:[\\(\\[]\\s*(?:Xbox|Windows|PC)\\b[^\\)\\]]*[\\)\\]]|\\b(?:for|-)\\s+(?:Windows|Xbox|PC)\\b.*)\\s*$', '', 'i'),
            '[\\s\\-\\(\\[\\:\\|\\/]+$', '', 'g'
          )) AS base_title
        FROM "Game"
      ),
      ranked AS (
        SELECT 
          id,
          title,
          base_title,
          platforms,
          FIRST_VALUE(id) OVER (
            PARTITION BY LOWER(base_title), product_group
            ORDER BY 
              CASE WHEN LOWER(title) = LOWER(base_title) THEN 0 ELSE 1 END,
              CASE WHEN "isCore" THEN 0 ELSE 1 END,
              "popularityScore" DESC,
              id ASC
          ) AS canonical_id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(base_title), product_group
            ORDER BY 
              CASE WHEN LOWER(title) = LOWER(base_title) THEN 0 ELSE 1 END,
              CASE WHEN "isCore" THEN 0 ELSE 1 END,
              "popularityScore" DESC,
              id ASC
          ) AS row_num,
          COUNT(*) OVER (
            PARTITION BY LOWER(base_title), product_group
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
      SET title = trim(regexp_replace(
        regexp_replace(title, '\\s*(?:[\\(\\[]\\s*(?:Xbox|Windows|PC)\\b[^\\)\\]]*[\\)\\]]|\\b(?:for|-)\\s+(?:Windows|Xbox|PC)\\b.*)\\s*$', '', 'i'),
        '[\\s\\-\\(\\[\\:\\|\\/]+$', '', 'g'
      ))
      WHERE "isPlatformVariant" = false
        AND title ~* '[\\(\\[]\\s*(?:Xbox|Windows|PC)\\b';
    `;
    await prisma.$executeRawUnsafe(cleanTitleSql);

    await reconcileUserNotifications(prisma);

    console.log("[Auto-Seed] Cross-platform deduplication and notification sync completed.");
  } catch (err) {
    console.warn("[Auto-Seed] Deduplication notice:", err.message);
  }
}

main().catch((e) => {
  console.warn("[Auto-Seed] Uncaught warning in auto-seed:", e.message);
});
