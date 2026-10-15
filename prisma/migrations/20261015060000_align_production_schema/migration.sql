-- Align SystemSetting with current Prisma schema
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

ALTER TABLE "SystemSetting"
    DROP COLUMN IF EXISTS "autoDiscoverPopular";

DO $$
BEGIN
    CREATE TYPE "BackupMode" AS ENUM ('FULL', 'CATALOG');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "BackupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'RESTORING');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DatabaseBackup" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mode" "BackupMode" NOT NULL DEFAULT 'FULL',
    "status" "BackupStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "tablesIncluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rowCountEstimate" INTEGER NOT NULL DEFAULT 0,
    "initiatedByUserId" TEXT,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DatabaseBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DatabaseBackup_filename_key"
    ON "DatabaseBackup"("filename");

CREATE INDEX IF NOT EXISTS "DatabaseBackup_startedAt_idx"
    ON "DatabaseBackup"("startedAt" DESC);
