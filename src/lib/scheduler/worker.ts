import { prisma } from "../db/prisma";
import { getSystemSettings, calculateScheduleInfo, SchedulerScheduleInfo } from "../settings/system-settings";
import { runIncrementalDiscovery, IncrementalDiscoveryResult } from "../xbox/incremental-discovery";
import { runPriceSync, SyncRunnerResult } from "../pricing/sync-runner";

export interface SchedulerTickReport {
  timestamp: string;
  schedule: SchedulerScheduleInfo;
  catalogDiscoveryExecuted: boolean;
  catalogDiscoveryResult?: IncrementalDiscoveryResult;
  priceSyncExecuted: boolean;
  priceSyncResult?: SyncRunnerResult;
}

/**
 * Worker tick evaluator that consumes PostgreSQL system settings
 * and executes scheduled catalog discovery or price sync when due.
 */
export async function runSchedulerTick(): Promise<SchedulerTickReport> {
  const settings = await getSystemSettings();
  const schedule = calculateScheduleInfo({
    autoDiscoverSeriesCatalog: settings.autoDiscoverSeriesCatalog,
    catalogDiscoveryIntervalHours: settings.catalogDiscoveryIntervalHours,
    priceSyncIntervalHours: settings.priceSyncIntervalHours,
    metadataRefreshIntervalHours: settings.metadataRefreshIntervalHours,
    relationshipRefreshIntervalHours: settings.relationshipRefreshIntervalHours,
    lastCatalogDiscoveryAt: settings.lastCatalogDiscoveryAt,
    lastPriceSyncAt: settings.lastPriceSyncAt,
  });

  const report: SchedulerTickReport = {
    timestamp: new Date().toISOString(),
    schedule,
    catalogDiscoveryExecuted: false,
    priceSyncExecuted: false,
  };

  // 1. Check if Catalog Discovery is due
  if (schedule.autoDiscoverSeriesCatalog && schedule.isCatalogDiscoveryDue) {
    console.log("[Scheduler] Series X|S Catalog Discovery is due. Running incremental discovery...");
    const result = await runIncrementalDiscovery({
      triggerSource: "SCHEDULER",
      maxPages: 5,
    });
    report.catalogDiscoveryExecuted = true;
    report.catalogDiscoveryResult = result;
  }

  // 2. Check if Price Sync is due
  if (schedule.isPriceSyncDue) {
    console.log("[Scheduler] Price Sync is due. Running price sync...");
    const result = await runPriceSync({
      triggerSource: "SCHEDULER",
    });

    if (result.success) {
      await prisma.systemSetting.update({
        where: { id: "global" },
        data: {
          lastPriceSyncAt: new Date(),
        },
      });
    }

    report.priceSyncExecuted = true;
    report.priceSyncResult = result;
  }

  return report;
}
