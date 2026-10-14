-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'USER');

-- CreateEnum
CREATE TYPE "PriceAlertType" AS ENUM ('ANY_DISCOUNT', 'PRICE_BELOW', 'DISCOUNT_AT_LEAST', 'OBSERVED_LOW', 'DEAL_SCORE_AT_LEAST');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('PRICE_DROP', 'ALERT_MATCHED', 'NEW_OBSERVED_LOW', 'DEAL_SCORE_THRESHOLD', 'OWNED_GAME_DLC_DEAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "wishlist" BOOLEAN NOT NULL DEFAULT false,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "disliked" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "PriceAlertType" NOT NULL DEFAULT 'ANY_DISCOUNT',
    "targetPrice" DECIMAL(10,2),
    "targetDiscount" INTEGER,
    "targetDealScore" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT,
    "type" "NotificationEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "allowRegistration" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalHours" INTEGER NOT NULL DEFAULT 6,
    "autoDiscoverPopular" BOOLEAN NOT NULL DEFAULT true,
    "autoDiscoverBundleChildren" BOOLEAN NOT NULL DEFAULT true,
    "autoDiscoverRelatedDlc" BOOLEAN NOT NULL DEFAULT true,
    "autoAddRelatedProducts" BOOLEAN NOT NULL DEFAULT true,
    "trackBaseGames" BOOLEAN NOT NULL DEFAULT true,
    "trackBundles" BOOLEAN NOT NULL DEFAULT true,
    "trackDlc" BOOLEAN NOT NULL DEFAULT true,
    "trackExpansions" BOOLEAN NOT NULL DEFAULT true,
    "trackSeasonPasses" BOOLEAN NOT NULL DEFAULT true,
    "trackAddons" BOOLEAN NOT NULL DEFAULT true,
    "trackContentPacks" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncFinishedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "UserGame_userId_owned_idx" ON "UserGame"("userId", "owned");
CREATE INDEX IF NOT EXISTS "UserGame_userId_favorite_idx" ON "UserGame"("userId", "favorite");
CREATE INDEX IF NOT EXISTS "UserGame_userId_wishlist_idx" ON "UserGame"("userId", "wishlist");
CREATE UNIQUE INDEX IF NOT EXISTS "UserGame_userId_gameId_key" ON "UserGame"("userId", "gameId");
CREATE INDEX IF NOT EXISTS "PriceAlert_gameId_isEnabled_idx" ON "PriceAlert"("gameId", "isEnabled");
CREATE INDEX IF NOT EXISTS "PriceAlert_userId_idx" ON "PriceAlert"("userId");
CREATE INDEX IF NOT EXISTS "NotificationEvent_userId_status_idx" ON "NotificationEvent"("userId", "status");
CREATE INDEX IF NOT EXISTS "NotificationEvent_createdAt_idx" ON "NotificationEvent"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
