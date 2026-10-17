-- AlterTable SystemSetting
ALTER TABLE "SystemSetting" 
  ADD COLUMN IF NOT EXISTS "autoDiscoverSeriesCatalog" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "catalogDiscoveryIntervalHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "priceSyncIntervalHours" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS "metadataRefreshIntervalHours" INTEGER NOT NULL DEFAULT 168,
  ADD COLUMN IF NOT EXISTS "relationshipRefreshIntervalHours" INTEGER NOT NULL DEFAULT 168,
  ADD COLUMN IF NOT EXISTS "lastCatalogDiscoveryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPriceSyncAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMetadataRefreshAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastRelationshipRefreshAt" TIMESTAMP(3);

-- Drop deprecated column
ALTER TABLE "SystemSetting" DROP COLUMN IF EXISTS "autoDiscoverPopular";
