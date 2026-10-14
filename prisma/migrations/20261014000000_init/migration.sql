-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('PRICE_SYNC', 'CORE_SYNC', 'DISCOVERY', 'RECLASSIFICATION');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "DealVerdict" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'WAIT', 'POOR');

-- CreateEnum
CREATE TYPE "ProductClass" AS ENUM ('BASE_GAME', 'BUNDLE', 'DLC', 'ADD_ON', 'EXPANSION', 'SEASON_PASS', 'CONTENT_PACK', 'CURRENCY', 'CONSUMABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('BUNDLE_CONTAINS', 'DLC_OF', 'EXPANSION_OF', 'ADDON_OF', 'SEASON_PASS_OF');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Game" (
    "id" TEXT NOT NULL,
    "xboxProductId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "publisher" TEXT,
    "developer" TEXT,
    "franchise" TEXT,
    "edition" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'Game',
    "productClass" "ProductClass" NOT NULL DEFAULT 'UNKNOWN',
    "releaseDate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "storeUrl" TEXT NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "listPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "historicalLow" DECIMAL(10,2) NOT NULL,
    "historicalLowAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GameRelation" (
    "id" TEXT NOT NULL,
    "parentGameId" TEXT NOT NULL,
    "childGameId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL DEFAULT 'BUNDLE_CONTAINS',
    "position" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MICROSOFT_DISPLAY_CATALOG',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listPrice" DECIMAL(10,2) NOT NULL,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "isOnSale" BOOLEAN NOT NULL DEFAULT false,
    "saleEndAt" TIMESTAMP(3),

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DealAnalysis" (
    "gameId" TEXT NOT NULL,
    "dealScore" INTEGER NOT NULL,
    "confidenceScore" "ConfidenceLevel" NOT NULL DEFAULT 'LOW',
    "historicalPosition" DOUBLE PRECISION NOT NULL,
    "saleFrequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysSinceBetterPrice" INTEGER,
    "verdict" "DealVerdict" NOT NULL DEFAULT 'WAIT',
    "reason" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealAnalysis_pkey" PRIMARY KEY ("gameId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncRun" (
    "id" TEXT NOT NULL,
    "type" "SyncType" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "productsChecked" INTEGER NOT NULL DEFAULT 0,
    "productsAdded" INTEGER NOT NULL DEFAULT 0,
    "pricesChanged" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_xboxProductId_key" ON "Game"("xboxProductId");
CREATE UNIQUE INDEX IF NOT EXISTS "Game_slug_key" ON "Game"("slug");
CREATE INDEX IF NOT EXISTS "Game_isCore_isActive_idx" ON "Game"("isCore", "isActive");
CREATE INDEX IF NOT EXISTS "Game_productClass_isActive_idx" ON "Game"("productClass", "isActive");
CREATE INDEX IF NOT EXISTS "Game_discountPercent_idx" ON "Game"("discountPercent" DESC);
CREATE INDEX IF NOT EXISTS "Game_historicalLow_idx" ON "Game"("historicalLow");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GameRelation_parentGameId_idx" ON "GameRelation"("parentGameId");
CREATE INDEX IF NOT EXISTS "GameRelation_childGameId_idx" ON "GameRelation"("childGameId");
CREATE UNIQUE INDEX IF NOT EXISTS "GameRelation_parentGameId_childGameId_relationType_key" ON "GameRelation"("parentGameId", "childGameId", "relationType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceHistory_gameId_observedAt_idx" ON "PriceHistory"("gameId", "observedAt" DESC);
CREATE INDEX IF NOT EXISTS "PriceHistory_gameId_currentPrice_idx" ON "PriceHistory"("gameId", "currentPrice" ASC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "GameRelation" ADD CONSTRAINT "GameRelation_parentGameId_fkey" FOREIGN KEY ("parentGameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GameRelation" ADD CONSTRAINT "GameRelation_childGameId_fkey" FOREIGN KEY ("childGameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "DealAnalysis" ADD CONSTRAINT "DealAnalysis_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
