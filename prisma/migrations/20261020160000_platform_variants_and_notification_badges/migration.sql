-- AlterTable Game
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "canonicalGameId" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "isPlatformVariant" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Game_isPlatformVariant_isActive_idx" ON "Game"("isPlatformVariant", "isActive");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Game_canonicalGameId_fkey'
    ) THEN
        ALTER TABLE "Game" ADD CONSTRAINT "Game_canonicalGameId_fkey" FOREIGN KEY ("canonicalGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable UserNotification
ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS "badges" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Enable Telegram Notifications by Default in Global Settings
UPDATE "SystemSetting" SET "telegramNotificationsEnabled" = true WHERE id = 'global';

-- ============================================================================
-- AUTOMATIC PRODUCTION DATA RECONCILIATION: Cross-Platform Game Deduplication
-- Groups platform variations (Windows PC, Xbox One, Xbox Series X|S) into one canonical game
-- ============================================================================
WITH cleaned AS (
  SELECT 
    id,
    title,
    "productClass",
    platforms,
    "isCore",
    "popularityScore",
    regexp_replace(
      trim(regexp_replace(title, '\s*[\(\[](Windows(?:\s*10(?:\/11)?)?|PC|Xbox One\s*&\s*Xbox Series X\|S|Xbox Series X\|S\s*&\s*Xbox One|Xbox One\/Series X\|S|Xbox Series X\|S|Xbox Series X|Xbox One|XBOX One|Windows Edition)[\)\]]\s*$', '', 'i')),
      '\s+(Windows|Xbox One|Xbox Series X\|S)\s*$', '', 'i'
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

-- Clean title of canonical games that had trailing platform suffixes
UPDATE "Game"
SET title = regexp_replace(
  trim(regexp_replace(title, '\s*[\(\[](Windows(?:\s*10(?:\/11)?)?|PC|Xbox One\s*&\s*Xbox Series X\|S|Xbox Series X\|S\s*&\s*Xbox One|Xbox One\/Series X\|S|Xbox Series X\|S|Xbox Series X|Xbox One|XBOX One|Windows Edition)[\)\]]\s*$', '', 'i')),
  '\s+(Windows|Xbox One|Xbox Series X\|S)\s*$', '', 'i'
)
WHERE "isPlatformVariant" = false
  AND title ~* '[\(\[](Windows|PC|Xbox One|Xbox Series X\|S|Windows 10)[\)\]]\s*$';

-- Merge platforms into canonical games
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
