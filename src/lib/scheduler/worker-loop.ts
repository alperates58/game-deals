import { prisma } from "../db/prisma";
import { ScheduledJobType } from "@prisma/client";
import { getSystemSettings } from "../settings/system-settings";
import { runScheduledJob, reconcileStaleRunningJobs } from "./job-runner";

export interface WorkerLoopOptions {
  pollIntervalMs?: number; // default: 30000 (30 seconds)
  singleTick?: boolean;    // useful for testing
}

export class AutonomousWorker {
  private isRunning = false;
  private shouldStop = false;
  private pollIntervalMs: number;

  constructor(options: WorkerLoopOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs || 30000;
  }

  /**
   * Initializes default ScheduledJobState records for all job types if not present.
   */
  public async initializeJobStates(): Promise<void> {
    const jobTypes = [
      ScheduledJobType.CATALOG_DISCOVERY,
      ScheduledJobType.PRICE_SYNC,
      ScheduledJobType.METADATA_REFRESH,
      ScheduledJobType.RELATIONSHIP_REFRESH,
    ];

    const settings = await getSystemSettings();
    const now = new Date();

    // Reconcile any stale RUNNING states left from an interrupted previous run
    await reconcileStaleRunningJobs().catch((err) =>
      console.error("[Worker] Error reconciling stale jobs on init:", err)
    );

    for (const jobType of jobTypes) {
      const existing = await prisma.scheduledJobState.findUnique({
        where: { jobType },
      });

      if (!existing) {
        let intervalHours = 24;
        let lastRunAt: Date | null = null;

        if (jobType === ScheduledJobType.CATALOG_DISCOVERY) {
          intervalHours = settings.catalogDiscoveryIntervalHours || 24;
          lastRunAt = settings.lastCatalogDiscoveryAt || null;
        } else if (jobType === ScheduledJobType.PRICE_SYNC) {
          intervalHours = settings.priceSyncIntervalHours || 6;
          lastRunAt = settings.lastPriceSyncAt || null;
        } else if (jobType === ScheduledJobType.METADATA_REFRESH) {
          intervalHours = settings.metadataRefreshIntervalHours || 168;
          lastRunAt = settings.lastMetadataRefreshAt || null;
        } else if (jobType === ScheduledJobType.RELATIONSHIP_REFRESH) {
          intervalHours = settings.relationshipRefreshIntervalHours || 168;
          lastRunAt = settings.lastRelationshipRefreshAt || null;
        }

        const nextRunAt = lastRunAt
          ? new Date(lastRunAt.getTime() + intervalHours * 3600 * 1000)
          : new Date(now); // run immediately on initial boot if never run before

        await prisma.scheduledJobState.create({
          data: {
            jobType,
            enabled: true,
            lastStartedAt: lastRunAt,
            lastFinishedAt: lastRunAt,
            lastSuccessAt: lastRunAt,
            nextRunAt,
          },
        });
        console.log(`[Worker] Initialized ScheduledJobState for ${jobType}. Next run: ${nextRunAt.toISOString()}`);
      }
    }
  }

  /**
   * Performs a single scheduler check tick.
   * Returns list of jobs executed during this tick.
   */
  public async tick(): Promise<ScheduledJobType[]> {
    // Reconcile any stale RUNNING states before evaluating due jobs
    await reconcileStaleRunningJobs().catch((err) =>
      console.error("[Worker] Error reconciling stale jobs on tick:", err)
    );

    const now = new Date();
    const settings = await getSystemSettings();
    const states = await prisma.scheduledJobState.findMany();
    const stateMap = new Map(states.map((s) => [s.jobType, s]));

    const executedJobs: ScheduledJobType[] = [];

    // Order of evaluation
    const jobTypes = [
      ScheduledJobType.PRICE_SYNC,
      ScheduledJobType.CATALOG_DISCOVERY,
      ScheduledJobType.METADATA_REFRESH,
      ScheduledJobType.RELATIONSHIP_REFRESH,
    ];

    for (const jobType of jobTypes) {
      if (this.shouldStop) break;

      const state = stateMap.get(jobType);
      if (!state || !state.enabled) continue;

      // Honor global master discovery toggle for catalog discovery
      if (jobType === ScheduledJobType.CATALOG_DISCOVERY && !settings.autoDiscoverSeriesCatalog) {
        continue;
      }

      const isDue = !state.nextRunAt || state.nextRunAt.getTime() <= now.getTime();

      if (isDue) {
        console.log(`[Worker] Job ${jobType} is due (nextRunAt: ${state.nextRunAt?.toISOString()}). Initiating run...`);
        try {
          const result = await runScheduledJob(jobType, "SCHEDULER");
          if (result.success) {
            console.log(`[Worker] Job ${jobType} completed successfully in ${result.durationMs}ms: ${result.message}`);
            executedJobs.push(jobType);
          } else if (result.locked) {
            console.log(`[Worker] Job ${jobType} postponed: ${result.message}`);
          } else {
            console.warn(`[Worker] Job ${jobType} finished with warning/failure: ${result.message}`);
          }
        } catch (jobErr: any) {
          // Never let an individual job error crash the entire worker process
          console.error(`[Worker] Uncaught exception in job ${jobType}:`, jobErr.message || jobErr);
        }
      }
    }

    // Process due notification deliveries (Email, Telegram, In-App)
    try {
      const { processNotificationDeliveries } = await import("../notifications/dispatcher");
      const deliveryStats = await processNotificationDeliveries(25);
      if (deliveryStats.processed > 0) {
        console.log(`[Worker] Dispatched ${deliveryStats.processed} notifications (sent: ${deliveryStats.sent}, retried: ${deliveryStats.retried}, failed: ${deliveryStats.failed})`);
      }
    } catch (deliveryErr: any) {
      console.error("[Worker] Notification delivery processing error:", deliveryErr?.message || deliveryErr);
    }

    return executedJobs;

  }

  /**
   * Starts the continuous background polling loop.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.shouldStop = false;

    console.log("==================================================");
    console.log("  GAME-DEALS AUTONOMOUS SCHEDULER WORKER STARTED  ");
    console.log(`  Poll Interval: ${this.pollIntervalMs / 1000}s`);
    console.log(`  Process ID: ${process.pid}`);
    console.log("==================================================");

    try {
      await this.initializeJobStates();
    } catch (initErr: any) {
      console.error("[Worker] Error during job states initialization:", initErr.message);
    }

    while (!this.shouldStop) {
      try {
        await this.tick();
      } catch (tickErr: any) {
        console.error("[Worker] Error in worker tick loop:", tickErr.message || tickErr);
      }

      // Non-busy sleep interruptible by stop()
      const sleepStart = Date.now();
      while (!this.shouldStop && Date.now() - sleepStart < this.pollIntervalMs) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.isRunning = false;
    console.log("[Worker] Autonomous worker stopped cleanly.");
  }

  /**
   * Requests graceful termination of the worker loop.
   */
  public stop(): void {
    console.log("[Worker] Graceful shutdown requested...");
    this.shouldStop = true;
  }
}
