-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('FULL_CATALOG', 'RELATED', 'MANUAL');

-- AlterEnum
ALTER TYPE "SyncType" ADD VALUE IF NOT EXISTS 'METADATA_REFRESH';
ALTER TYPE "SyncType" ADD VALUE IF NOT EXISTS 'RELATIONSHIP_REFRESH';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "discoverySource" "DiscoverySource" NOT NULL DEFAULT 'FULL_CATALOG',
ADD COLUMN "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isSeriesXCompatible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Game_isSeriesXCompatible_isActive_idx" ON "Game"("isSeriesXCompatible", "isActive");
CREATE INDEX "Game_discoverySource_idx" ON "Game"("discoverySource");
