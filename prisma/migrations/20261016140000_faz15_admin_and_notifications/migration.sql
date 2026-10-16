-- ============================================================
-- GAME DEALS FAZ 1.5 — ADMIN CONTROL CENTER + NOTIFICATIONS MIGRATION
-- NON-DESTRUCTIVE, IDEMPOTENT POSTGRESQL MIGRATION
-- ============================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'PRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'RETRYING', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "RatingProvider" AS ENUM ('METACRITIC', 'OPENCRITIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionService" AS ENUM ('GAME_PASS', 'PS_PLUS', 'EA_PLAY', 'UBISOFT_PLUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "MediaType" AS ENUM ('TRAILER', 'GAMEPLAY', 'REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Expand NotificationEventType if not present
DO $$ BEGIN
    ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'WISHLIST_DEAL';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'FAVORITE_PRICE_CHANGE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Alter Existing Tables Safely
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipTier" "MembershipTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "siteName" TEXT NOT NULL DEFAULT 'Game Deals';
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "showDeals" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "showHistoricalLow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "showDlc" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "showRatings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "showSubscriptions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "inAppNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "telegramNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "defaultTitle" TEXT NOT NULL DEFAULT 'Game Deals | Türkiye Xbox Oyun İndirimleri ve Fırsat Takibi';
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "defaultDescription" TEXT NOT NULL DEFAULT 'Xbox Series X|S oyun indirimleri, tarihi dip fiyatlar, DLC fırsatları ve yapay zeka destekli fiyat analizi.';
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "robotsIndex" BOOLEAN NOT NULL DEFAULT true;

-- 3. Create New Tables If Not Exist

-- Email Verification
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- Telegram Connection & Linking
CREATE TABLE IF NOT EXISTS "TelegramConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "displayName" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- User Notification Preferences & Settings
CREATE TABLE IF NOT EXISTS "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserNotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "defaultAlertType" "PriceAlertType" NOT NULL DEFAULT 'ANY_DISCOUNT',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'tr-TR',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- Notification Delivery Queue
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastErrorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- In-App User Notifications Inbox
CREATE TABLE IF NOT EXISTS "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- Admin Audit Log
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "targetUserId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- Manual Overrides
CREATE TABLE IF NOT EXISTS "GameManualOverride" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "title" TEXT,
    "publisher" TEXT,
    "developer" TEXT,
    "franchise" TEXT,
    "releaseDate" TIMESTAMP(3),
    "productClass" "ProductClass",
    "imageUrl" TEXT,
    "isActive" BOOLEAN,
    "updatedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameManualOverride_pkey" PRIMARY KEY ("id")
);

-- External Ratings
CREATE TABLE IF NOT EXISTS "ExternalRating" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "RatingProvider" NOT NULL,
    "criticScore" DOUBLE PRECISION,
    "userScore" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRating_pkey" PRIMARY KEY ("id")
);

-- Game Subscriptions
CREATE TABLE IF NOT EXISTS "GameSubscription" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "service" "SubscriptionService" NOT NULL,
    "tier" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MICROSOFT_STORE',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSubscription_pkey" PRIMARY KEY ("id")
);

-- Game Language Support
CREATE TABLE IF NOT EXISTS "GameLanguageSupport" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "interfaceSupported" BOOLEAN NOT NULL DEFAULT false,
    "subtitlesSupported" BOOLEAN NOT NULL DEFAULT false,
    "audioSupported" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLanguageSupport_pkey" PRIMARY KEY ("id")
);

-- Game Media
CREATE TABLE IF NOT EXISTS "GameMedia" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'TRAILER',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'YOUTUBE',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMedia_pkey" PRIMARY KEY ("id")
);

-- 4. Create Unique Constraints and Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramConnection_userId_key" ON "TelegramConnection"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramConnection_telegramChatId_key" ON "TelegramConnection"("telegramChatId");
CREATE INDEX IF NOT EXISTS "TelegramConnection_telegramChatId_idx" ON "TelegramConnection"("telegramChatId");

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_tokenHash_idx" ON "TelegramLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_userId_idx" ON "TelegramLinkToken"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "UserNotificationPreference_userId_eventType_channel_key" ON "UserNotificationPreference"("userId", "eventType", "channel");
CREATE INDEX IF NOT EXISTS "UserNotificationPreference_userId_idx" ON "UserNotificationPreference"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "UserNotificationSettings_userId_key" ON "UserNotificationSettings"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_eventId_channel_key" ON "NotificationDelivery"("eventId", "channel");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");

CREATE INDEX IF NOT EXISTS "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "NotificationEvent_type_idx" ON "NotificationEvent"("type");

CREATE INDEX IF NOT EXISTS "User_role_accountStatus_idx" ON "User"("role", "accountStatus");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "GameManualOverride_gameId_key" ON "GameManualOverride"("gameId");
CREATE INDEX IF NOT EXISTS "GameManualOverride_gameId_idx" ON "GameManualOverride"("gameId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalRating_gameId_provider_key" ON "ExternalRating"("gameId", "provider");
CREATE INDEX IF NOT EXISTS "ExternalRating_gameId_idx" ON "ExternalRating"("gameId");

CREATE UNIQUE INDEX IF NOT EXISTS "GameSubscription_gameId_service_key" ON "GameSubscription"("gameId", "service");
CREATE INDEX IF NOT EXISTS "GameSubscription_service_isActive_idx" ON "GameSubscription"("service", "isActive");
CREATE INDEX IF NOT EXISTS "GameSubscription_gameId_idx" ON "GameSubscription"("gameId");

CREATE UNIQUE INDEX IF NOT EXISTS "GameLanguageSupport_gameId_languageCode_key" ON "GameLanguageSupport"("gameId", "languageCode");
CREATE INDEX IF NOT EXISTS "GameLanguageSupport_gameId_idx" ON "GameLanguageSupport"("gameId");
CREATE INDEX IF NOT EXISTS "GameLanguageSupport_languageCode_idx" ON "GameLanguageSupport"("languageCode");

CREATE INDEX IF NOT EXISTS "GameMedia_gameId_isActive_idx" ON "GameMedia"("gameId", "isActive");

-- 5. Foreign Key Constraints (Protected with DO EXCEPTION blocks)
DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TelegramConnection" ADD CONSTRAINT "TelegramConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "UserNotificationSettings" ADD CONSTRAINT "UserNotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GameManualOverride" ADD CONSTRAINT "GameManualOverride_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GameManualOverride" ADD CONSTRAINT "GameManualOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ExternalRating" ADD CONSTRAINT "ExternalRating_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GameSubscription" ADD CONSTRAINT "GameSubscription_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GameLanguageSupport" ADD CONSTRAINT "GameLanguageSupport_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GameMedia" ADD CONSTRAINT "GameMedia_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
