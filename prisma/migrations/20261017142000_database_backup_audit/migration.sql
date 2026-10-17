-- CreateEnum safely
DO $$ 
BEGIN
    CREATE TYPE "BackupMode" AS ENUM ('FULL', 'CATALOG');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum safely
DO $$ 
BEGIN
    CREATE TYPE "BackupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'RESTORING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable safely
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

-- CreateIndex safely
CREATE UNIQUE INDEX IF NOT EXISTS "DatabaseBackup_filename_key" ON "DatabaseBackup"("filename");

-- CreateIndex safely
CREATE INDEX IF NOT EXISTS "DatabaseBackup_startedAt_idx" ON "DatabaseBackup"("startedAt" DESC);
