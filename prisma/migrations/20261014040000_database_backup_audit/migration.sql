-- CreateEnum
CREATE TYPE "BackupMode" AS ENUM ('FULL', 'CATALOG');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'RESTORING');

-- CreateTable
CREATE TABLE "DatabaseBackup" (
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

-- CreateIndex
CREATE UNIQUE INDEX "DatabaseBackup_filename_key" ON "DatabaseBackup"("filename");

-- CreateIndex
CREATE INDEX "DatabaseBackup_startedAt_idx" ON "DatabaseBackup"("startedAt" DESC);
