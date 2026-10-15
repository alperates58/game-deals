import { prisma } from "../db/prisma";
import { ScheduledJobType, ScheduledJobStatus } from "@prisma/client";
import {
  withXboxJobLocks,
  resetLocalAdvisoryLocks,
  LockClientFactory,
} from "../db/advisory-lock";
import { runIncrementalDiscovery } from "../xbox/incremental-discovery";
import { runPriceSync } from "../pricing/sync-runner";
import { runMetadataRefresh } from "../xbox/metadata-refresh";
import { runRelationshipRefresh } from "../xbox/relationship-refresh";
import { getSystemSettings } from "../settings/system-settings";

export type TriggerSource = "MANUAL_SETTINGS_UI" | "SCHEDULER" | "CLI";

export interface ScheduledJobRunResult {
  success: boolean;
  locked?: boolean;
  code?: string;
  message: string;
  durationMs: number;
  itemsProcessed: number;
  itemsAdded: number;
  itemsChanged: number;
  errorCount: number;
  rateLimitHits?: number;
}

/** Default safe timeout threshold for stale RUNNING reconciliation (30 minutes) */
export const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Sanitizes error messages by scrubbing potential connection strings, tokens, and secrets.
 */
export function sanitizeErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  return message
    .replace(
      /postgresql:\/\/[^:]+:[^@]+@[^/]+\/[^?\s]+/gi,
      "postgresql://[REDACTED_CREDENTIALS]@[REDACTED_HOST]/[DB]"
    )
    .replace(/(password|secret|token|bearer|key)=([^\s&]+)/gi, "$1=[REDACTED]")
    .slice(0, 1000); // Prevent unbounded string length in DB
}

/**
 * Reconciles stale RUNNING jobs that may have been abandoned due to container restarts, crashes, or unhandled failures.
 * If a job has been in RUNNING state longer than the timeout threshold, it is automatically marked as FAILED
 * and its nextRunAt is recomputed so the scheduler can recover naturally.
 */
export async function reconcileStaleRunningJobs(
  timeoutMs: number = STALE_JOB_TIMEOUT_MS
): Promise<ScheduledJobType[]> {
  const now = new Date();
  const threshold = new Date(now.getTime() - timeoutMs);

  const staleJobs = await prisma.scheduledJobState.findMany({
    where: {
      lastStatus: ScheduledJobStatus.RUNNING,
      OR: [{ lastStartedAt: { lt: threshold } }, { lastStartedAt: null }],
    },
  });

  if (staleJobs.length === 0) {
    return [];
  }

  const settings = await getSystemSettings().catch(() => null);
  const reconciledTypes: ScheduledJobType[] = [];

  for (const job of staleJobs) {
    let intervalHours = 24;
    if (job.jobType === ScheduledJobType.PRICE_SYNC) {
      intervalHours = settings?.priceSyncIntervalHours || 6;
    } else if (job.jobType === ScheduledJobType.CATALOG_DISCOVERY) {
      intervalHours = settings?.catalogDiscoveryIntervalHours || 24;
    } else if (job.jobType === ScheduledJobType.METADATA_REFRESH) {
      intervalHours = settings?.metadataRefreshIntervalHours || 168;
    } else if (job.jobType === ScheduledJobType.RELATIONSHIP_REFRESH) {
      intervalHours = settings?.relationshipRefreshIntervalHours || 168;
    }

    const nextRunAt = new Date(now.getTime() + intervalHours * 3600 * 1000);

    await prisma.scheduledJobState.update({
      where: { id: job.id },
      data: {
        lastStatus: ScheduledJobStatus.FAILED,
        lastFinishedAt: now,
        lastErrorSummary:
          "İş beklenenden uzun sürdü veya önceki süreç sonlandı (Stale RUNNING reconciled).",
        nextRunAt,
      },
    });

    console.warn(
      `[JobRunner] Reconciled stale RUNNING job ${job.jobType} (started at: ${job.lastStartedAt?.toISOString() || "unknown"}). Next run scheduled for: ${nextRunAt.toISOString()}`
    );
    reconciledTypes.push(job.jobType);
  }

  return reconciledTypes;
}

/**
 * Resets any stuck state requested by an administrator.
 * Cleans up local in-memory lock connections and repairs any jobs currently marked RUNNING.
 */
export async function resetStuckJobStates(): Promise<{
  repairedJobs: ScheduledJobType[];
}> {
  await resetLocalAdvisoryLocks();

  const runningJobs = await prisma.scheduledJobState.findMany({
    where: { lastStatus: ScheduledJobStatus.RUNNING },
  });

  const now = new Date();
  const settings = await getSystemSettings().catch(() => null);
  const repairedJobs: ScheduledJobType[] = [];

  for (const job of runningJobs) {
    let intervalHours = 24;
    if (job.jobType === ScheduledJobType.PRICE_SYNC) {
      intervalHours = settings?.priceSyncIntervalHours || 6;
    } else if (job.jobType === ScheduledJobType.CATALOG_DISCOVERY) {
      intervalHours = settings?.catalogDiscoveryIntervalHours || 24;
    } else if (job.jobType === ScheduledJobType.METADATA_REFRESH) {
      intervalHours = settings?.metadataRefreshIntervalHours || 168;
    } else if (job.jobType === ScheduledJobType.RELATIONSHIP_REFRESH) {
      intervalHours = settings?.relationshipRefreshIntervalHours || 168;
    }

    const nextRunAt = new Date(now.getTime() + intervalHours * 3600 * 1000);

    await prisma.scheduledJobState.update({
      where: { id: job.id },
      data: {
        lastStatus: ScheduledJobStatus.FAILED,
        lastFinishedAt: now,
        lastErrorSummary: "Kullanıcı talebiyle durum sıfırlandı (Stuck State Reset).",
        nextRunAt,
      },
    });

    repairedJobs.push(job.jobType);
  }

  return { repairedJobs };
}

/**
 * Common Unified Job Runner for both autonomous background workers and manual Settings UI actions.
 * Guarantees dedicated connection-safe PostgreSQL advisory locks, metric tracking, error isolation,
 * and persistent state updates.
 */
export async function runScheduledJob(
  jobType: ScheduledJobType,
  triggerSource: TriggerSource = "SCHEDULER",
  customOptions?: { maxPages?: number; limit?: number; fullCrawl?: boolean },
  lockOptions?: { clientFactory?: LockClientFactory }
): Promise<ScheduledJobRunResult> {
  // 1. Reconcile any existing stale RUNNING records first
  await reconcileStaleRunningJobs().catch((err) =>
    console.error("[JobRunner] Error during stale reconciliation:", err)
  );

  // 2. Fetch or initialize ScheduledJobState record
  const jobState = await prisma.scheduledJobState.upsert({
    where: { jobType },
    create: {
      jobType,
      enabled: true,
      lastStatus: ScheduledJobStatus.IDLE,
    },
    update: {},
  });

  // If triggered by scheduler and job is explicitly disabled, abort gracefully
  if (triggerSource === "SCHEDULER" && !jobState.enabled) {
    return {
      success: false,
      message: `İş (${jobType}) devre dışı bırakıldığı için zamanlayıcı tarafından çalıştırılmadı.`,
      durationMs: 0,
      itemsProcessed: 0,
      itemsAdded: 0,
      itemsChanged: 0,
      errorCount: 0,
    };
  }

  // 3. Execute under dedicated PostgreSQL connection advisory locks (Option B)
  const lockResult = await withXboxJobLocks(
    jobType as any,
    async () => {
      const startTime = Date.now();
      const runStartedAt = new Date();

      // Mark job as RUNNING in database
      await prisma.scheduledJobState.update({
        where: { jobType },
        data: {
          lastStatus: ScheduledJobStatus.RUNNING,
          lastStartedAt: runStartedAt,
          lastErrorSummary: null,
        },
      });

      let itemsProcessed = 0;
      let itemsAdded = 0;
      let itemsChanged = 0;
      let errorCount = 0;
      let rateLimitHits = 0;
      let jobSuccess = false;
      let jobStatus: ScheduledJobStatus = ScheduledJobStatus.COMPLETED;
      let resultMessage = "";
      let errorSummary: string | null = null;

      try {
        switch (jobType) {
          case ScheduledJobType.CATALOG_DISCOVERY: {
            const res = await runIncrementalDiscovery({
              triggerSource,
              maxPages: customOptions?.maxPages,
              fullCrawl: customOptions?.fullCrawl,
              skipLock: true, // Lock is held by withXboxJobLocks
            });
            jobSuccess = res.success;
            resultMessage = res.message;
            if (res.stats) {
              itemsProcessed = res.stats.rawDiscovered;
              itemsAdded = res.stats.productsAdded;
              itemsChanged = res.stats.productsUpdated;
            }
            if (!jobSuccess && res.locked) {
              jobStatus = ScheduledJobStatus.CANCELLED;
            } else if (!jobSuccess) {
              jobStatus = ScheduledJobStatus.FAILED;
            }
            break;
          }

          case ScheduledJobType.PRICE_SYNC: {
            const res = await runPriceSync({
              triggerSource,
              limit: customOptions?.limit,
              skipLock: true, // Lock is held by withXboxJobLocks
            });
            jobSuccess = res.success;
            resultMessage = res.message;
            if (res.stats) {
              itemsProcessed = res.stats.checked;
              itemsChanged = res.stats.pricesChanged;
              errorCount = res.stats.errors;
            }
            if (errorCount > 0 && jobSuccess) {
              jobStatus = ScheduledJobStatus.PARTIAL;
            } else if (!jobSuccess) {
              jobStatus = ScheduledJobStatus.FAILED;
            }
            break;
          }

          case ScheduledJobType.METADATA_REFRESH: {
            const res = await runMetadataRefresh({
              triggerSource,
              limit: customOptions?.limit,
            });
            jobSuccess = res.success;
            resultMessage = res.message;
            itemsProcessed = res.stats.processed;
            itemsChanged = res.stats.metadataUpdated;
            errorCount = res.stats.errors;
            if (errorCount > 0 && jobSuccess) {
              jobStatus = ScheduledJobStatus.PARTIAL;
            } else if (!jobSuccess) {
              jobStatus = ScheduledJobStatus.FAILED;
            }
            break;
          }

          case ScheduledJobType.RELATIONSHIP_REFRESH: {
            const res = await runRelationshipRefresh({
              triggerSource,
              limit: customOptions?.limit,
            });
            jobSuccess = res.success;
            resultMessage = res.message;
            itemsProcessed = res.stats.bundlesChecked;
            itemsAdded = res.stats.relationsCreated;
            itemsChanged = res.stats.relationsCleaned;
            errorCount = res.stats.errors;
            if (errorCount > 0 && jobSuccess) {
              jobStatus = ScheduledJobStatus.PARTIAL;
            } else if (!jobSuccess) {
              jobStatus = ScheduledJobStatus.FAILED;
            }
            break;
          }
        }
      } catch (err: any) {
        console.error(`[JobRunner] Fatal execution error in ${jobType}:`, err);
        jobSuccess = false;
        jobStatus = ScheduledJobStatus.FAILED;
        errorCount++;
        resultMessage = `Kritik iş hatası: ${err.message}`;
        errorSummary = sanitizeErrorMessage(err.message || String(err));
      }

      const durationMs = Date.now() - startTime;
      const finishedAt = new Date();

      // Compute nextRunAt based on SystemSettings interval
      const settings = await getSystemSettings().catch(() => null);
      let intervalHours = 24;
      if (jobType === ScheduledJobType.CATALOG_DISCOVERY) {
        intervalHours = settings?.catalogDiscoveryIntervalHours || 24;
      } else if (jobType === ScheduledJobType.PRICE_SYNC) {
        intervalHours = settings?.priceSyncIntervalHours || 6;
      } else if (jobType === ScheduledJobType.METADATA_REFRESH) {
        intervalHours = settings?.metadataRefreshIntervalHours || 168;
      } else if (jobType === ScheduledJobType.RELATIONSHIP_REFRESH) {
        intervalHours = settings?.relationshipRefreshIntervalHours || 168;
      }

      const nextRunAt = new Date(finishedAt.getTime() + intervalHours * 3600 * 1000);

      // Update ScheduledJobState with all run metrics
      await prisma.scheduledJobState.update({
        where: { jobType },
        data: {
          lastStatus: jobStatus,
          lastFinishedAt: finishedAt,
          lastSuccessAt: jobSuccess ? finishedAt : jobState.lastSuccessAt,
          nextRunAt,
          lastDurationMs: durationMs,
          lastItemsProcessed: itemsProcessed,
          lastItemsAdded: itemsAdded,
          lastItemsChanged: itemsChanged,
          lastErrorCount: errorCount,
          last429Count: rateLimitHits,
          lastErrorSummary:
            errorSummary || (errorCount > 0 ? sanitizeErrorMessage(resultMessage) : null),
        },
      });

      return {
        success: jobSuccess,
        message: resultMessage,
        durationMs,
        itemsProcessed,
        itemsAdded,
        itemsChanged,
        errorCount,
        rateLimitHits,
      };
    },
    lockOptions
  );

  // If locks could not be acquired or error occurred during locking
  if (!lockResult.acquired) {
    return {
      success: false,
      locked: true,
      code: lockResult.code,
      message: lockResult.reason || "Kilit alınamadı.",
      durationMs: 0,
      itemsProcessed: 0,
      itemsAdded: 0,
      itemsChanged: 0,
      errorCount: 0,
    };
  }

  return lockResult.data;
}
