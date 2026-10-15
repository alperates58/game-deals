import { prisma } from "./prisma";

/**
 * Advisory Lock Keys for Autonomous Operations & Xbox API Coordination.
 * Distinct 64-bit integer identifiers in PostgreSQL.
 */
export const ADVISORY_LOCK_KEYS = {
  // Global lock ensuring no two Xbox upstream operations collide (rate limit & 429 protection)
  GLOBAL_XBOX_API: 884729100,

  // Per-job specific locks (prevent concurrent duplicate runs of the exact same job)
  CATALOG_DISCOVERY: 884729101,
  PRICE_SYNC: 884729102,
  METADATA_REFRESH: 884729103,
  RELATIONSHIP_REFRESH: 884729104,
} as const;

export type AdvisoryLockJobType =
  | "CATALOG_DISCOVERY"
  | "PRICE_SYNC"
  | "METADATA_REFRESH"
  | "RELATIONSHIP_REFRESH";

// Default legacy sync lock key for backward compatibility
const DEFAULT_LEGACY_LOCK_KEY = ADVISORY_LOCK_KEYS.PRICE_SYNC;

export async function acquireAdvisoryLock(key: number = DEFAULT_LEGACY_LOCK_KEY): Promise<boolean> {
  try {
    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock(${key}) AS acquired;`
    );
    return Boolean(result?.[0]?.acquired);
  } catch (error) {
    console.error("[AdvisoryLock] Error acquiring lock:", error);
    return false;
  }
}

export async function releaseAdvisoryLock(key: number = DEFAULT_LEGACY_LOCK_KEY): Promise<boolean> {
  try {
    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT pg_advisory_unlock(${key}) AS released;`
    );
    return Boolean(result?.[0]?.released);
  } catch (error) {
    console.error("[AdvisoryLock] Error releasing lock:", error);
    return false;
  }
}

export interface LockAcquisitionResult {
  acquired: boolean;
  code?: "ACQUIRED" | "ALREADY_RUNNING" | "GLOBAL_XBOX_API_BUSY" | "ERROR";
  reason?: string;
  jobKey?: number;
}

/**
 * Acquires a two-level lock for an autonomous Xbox job:
 * 1. Specific job lock (prevents duplicate runs of same job)
 * 2. Global Xbox API lock (prevents upstream rate-limit exhaustion and 429 errors)
 */
export async function acquireXboxJobLocks(jobType: AdvisoryLockJobType): Promise<LockAcquisitionResult> {
  const jobKey = ADVISORY_LOCK_KEYS[jobType];

  try {
    // 1. Try acquiring specific job lock
    const jobLockAcquired = await acquireAdvisoryLock(jobKey);
    if (!jobLockAcquired) {
      return {
        acquired: false,
        code: "ALREADY_RUNNING",
        reason: `Aynı iş (${jobType}) şu anda başka bir süreç tarafından yürütülüyor. Advisory lock devrede.`,
        jobKey,
      };
    }

    // 2. Try acquiring global Xbox API lock
    const globalLockAcquired = await acquireAdvisoryLock(ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API);
    if (!globalLockAcquired) {
      // Release specific lock immediately to prevent deadlocks or dangling locks
      await releaseAdvisoryLock(jobKey);
      return {
        acquired: false,
        code: "GLOBAL_XBOX_API_BUSY",
        reason: `Başka bir Xbox mağaza işlemi (fiyat, tarama veya metadata) şu anda yürütülüyor. Hız limiti (429) koruması devrede.`,
        jobKey,
      };
    }

    return {
      acquired: true,
      code: "ACQUIRED",
      reason: "Kilit başarıyla alındı.",
      jobKey,
    };
  } catch (error: any) {
    console.error(`[AdvisoryLock] Error acquiring locks for ${jobType}:`, error);
    // Cleanup if any
    await releaseAdvisoryLock(jobKey).catch(() => {});
    return {
      acquired: false,
      code: "ERROR",
      reason: error?.message || "Kilit alınırken veritabanı hatası oluştu.",
      jobKey,
    };
  }
}

/**
 * Releases both the global Xbox API lock and the specific job lock.
 */
export async function releaseXboxJobLocks(jobType: AdvisoryLockJobType): Promise<void> {
  const jobKey = ADVISORY_LOCK_KEYS[jobType];
  try {
    await releaseAdvisoryLock(ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API);
  } catch (error) {
    console.error("[AdvisoryLock] Error releasing global lock:", error);
  }
  try {
    await releaseAdvisoryLock(jobKey);
  } catch (error) {
    console.error(`[AdvisoryLock] Error releasing job lock for ${jobType}:`, error);
  }
}

export async function forceReleaseAllAdvisoryLocks(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock_all();`);
  } catch (error) {
    console.error("[AdvisoryLock] Error force unlocking all:", error);
  }
}
