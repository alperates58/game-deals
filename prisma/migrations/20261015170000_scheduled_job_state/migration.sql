-- Non-destructive migration for Autonomous Operations (ScheduledJobState)

DO $$
BEGIN
    CREATE TYPE "ScheduledJobType" AS ENUM (
        'CATALOG_DISCOVERY',
        'PRICE_SYNC',
        'METADATA_REFRESH',
        'RELATIONSHIP_REFRESH'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "ScheduledJobStatus" AS ENUM (
        'IDLE',
        'RUNNING',
        'COMPLETED',
        'PARTIAL',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ScheduledJobState" (
    "id" TEXT NOT NULL,
    "jobType" "ScheduledJobType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastStatus" "ScheduledJobStatus" NOT NULL DEFAULT 'IDLE',
    "lastErrorSummary" TEXT,
    "lastDurationMs" INTEGER,
    "lastItemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "lastItemsAdded" INTEGER NOT NULL DEFAULT 0,
    "lastItemsChanged" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCount" INTEGER NOT NULL DEFAULT 0,
    "last429Count" INTEGER NOT NULL DEFAULT 0,
    "last5xxCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledJobState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledJobState_jobType_key"
    ON "ScheduledJobState"("jobType");

CREATE INDEX IF NOT EXISTS "ScheduledJobState_jobType_idx"
    ON "ScheduledJobState"("jobType");

CREATE INDEX IF NOT EXISTS "ScheduledJobState_nextRunAt_idx"
    ON "ScheduledJobState"("nextRunAt");
