import { Client } from "pg";

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

/**
 * Minimal interface for a PostgreSQL client capable of acquiring and releasing advisory locks.
 * Enables deterministic mocking and unit testing without a live database.
 */
export interface ILockClient {
  connect(): Promise<any>;
  query(queryText: string, values?: any[]): Promise<{ rows: any[] }>;
  end(): Promise<any>;
}

export type LockClientFactory = () => ILockClient | Promise<ILockClient>;

/**
 * Default factory returning a dedicated pg.Client connection instance.
 */
export function defaultLockClientFactory(): ILockClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not defined");
  }
  return new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });
}

export type XboxJobLockResult<T> =
  | {
      acquired: true;
      code: "ACQUIRED";
      data: T;
      jobKey: number;
    }
  | {
      acquired: false;
      code: "ALREADY_RUNNING";
      reason: string;
      jobKey: number;
    }
  | {
      acquired: false;
      code: "GLOBAL_XBOX_API_BUSY";
      reason: string;
      jobKey: number;
    }
  | {
      acquired: false;
      code: "ERROR";
      reason: string;
      error?: any;
      jobKey?: number;
    };

/**
 * Executes a long-running Xbox job under a two-level PostgreSQL advisory lock
 * using a DEDICATED PostgreSQL connection (Option B).
 *
 * Concurrency Flow:
 * 1. Open dedicated pg connection
 * 2. Acquire JOB lock on dedicated connection
 * 3. Acquire GLOBAL_XBOX_API lock on the exact same dedicated connection
 * 4. Execute the protected job task
 * 5. In finally:
 *    - Release GLOBAL_XBOX_API lock on the exact same dedicated connection
 *    - Release JOB lock on the exact same dedicated connection
 *    - Close dedicated connection
 *
 * If the worker process or network fails:
 * PostgreSQL automatically releases all session advisory locks when the client connection terminates.
 */
export async function withXboxJobLocks<T>(
  jobType: AdvisoryLockJobType,
  task: () => Promise<T>,
  options?: { clientFactory?: LockClientFactory }
): Promise<XboxJobLockResult<T>> {
  const jobKey = ADVISORY_LOCK_KEYS[jobType];
  const factory = options?.clientFactory || defaultLockClientFactory;

  let client: ILockClient | null = null;
  let jobLockAcquired = false;
  let globalLockAcquired = false;

  try {
    client = await factory();
    await client.connect();

    // 1. Acquire specific job lock on this dedicated connection
    const jobRes = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [jobKey]);
    jobLockAcquired = Boolean(jobRes?.rows?.[0]?.acquired);

    if (!jobLockAcquired) {
      await client.end().catch(() => {});
      client = null;
      return {
        acquired: false,
        code: "ALREADY_RUNNING",
        reason: `Aynı iş (${jobType}) şu anda başka bir süreç tarafından yürütülüyor. PostgreSQL advisory lock devrede.`,
        jobKey,
      };
    }

    // 2. Acquire global Xbox API lock on the EXACT SAME dedicated connection
    const globalRes = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [
      ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API,
    ]);
    globalLockAcquired = Boolean(globalRes?.rows?.[0]?.acquired);

    if (!globalLockAcquired) {
      // Global lock busy: release the specific job lock on this exact same connection before exiting
      await client.query("SELECT pg_advisory_unlock($1) AS released;", [jobKey]).catch(() => {});
      jobLockAcquired = false;
      await client.end().catch(() => {});
      client = null;
      return {
        acquired: false,
        code: "GLOBAL_XBOX_API_BUSY",
        reason:
          "Başka bir Xbox mağaza işlemi (fiyat, tarama veya metadata) şu anda yürütülüyor. Hız limiti (429) koruması devrede.",
        jobKey,
      };
    }

    // 3. Both locks acquired on the dedicated connection: execute job
    const data = await task();

    return {
      acquired: true,
      code: "ACQUIRED",
      data,
      jobKey,
    };
  } catch (err: any) {
    console.error(`[AdvisoryLock] Error during locked execution of ${jobType}:`, err);
    return {
      acquired: false,
      code: "ERROR",
      reason: err?.message || "Kilit alma veya iş çalıştırma sırasında hata oluştu.",
      error: err,
      jobKey,
    };
  } finally {
    // Guarantees release in finally on the exact same client connection
    if (client) {
      try {
        if (globalLockAcquired) {
          await client
            .query("SELECT pg_advisory_unlock($1) AS released;", [
              ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API,
            ])
            .catch((e) => console.error("[AdvisoryLock] Error releasing global lock:", e));
        }
        if (jobLockAcquired) {
          await client
            .query("SELECT pg_advisory_unlock($1) AS released;", [jobKey])
            .catch((e) => console.error("[AdvisoryLock] Error releasing job lock:", e));
        }
      } finally {
        await client.end().catch(() => {});
      }
    }
  }
}

/**
 * Scoped helper for single-lock operations using a dedicated connection.
 */
export async function withAdvisoryLock<T>(
  key: number,
  task: () => Promise<T>,
  options?: { clientFactory?: LockClientFactory }
): Promise<{ acquired: boolean; data?: T; error?: any }> {
  const factory = options?.clientFactory || defaultLockClientFactory;
  let client: ILockClient | null = null;
  let lockAcquired = false;

  try {
    client = await factory();
    await client.connect();
    const res = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [key]);
    lockAcquired = Boolean(res?.rows?.[0]?.acquired);

    if (!lockAcquired) {
      return { acquired: false };
    }

    const data = await task();
    return { acquired: true, data };
  } catch (error) {
    return { acquired: false, error };
  } finally {
    if (client) {
      try {
        if (lockAcquired) {
          await client.query("SELECT pg_advisory_unlock($1) AS released;", [key]).catch(() => {});
        }
      } finally {
        await client.end().catch(() => {});
      }
    }
  }
}

/**
 * In-memory map of dedicated client instances for legacy acquireAdvisoryLock/releaseAdvisoryLock.
 * Ensures acquisition and release always occur on the EXACT SAME client connection.
 */
const legacyDedicatedClients = new Map<number, ILockClient>();

export async function acquireAdvisoryLock(
  key: number = ADVISORY_LOCK_KEYS.PRICE_SYNC,
  options?: { clientFactory?: LockClientFactory }
): Promise<boolean> {
  if (legacyDedicatedClients.has(key)) return true;

  const factory = options?.clientFactory || defaultLockClientFactory;
  let client: ILockClient | null = null;
  try {
    client = await factory();
    await client.connect();
    const res = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [key]);
    const acquired = Boolean(res?.rows?.[0]?.acquired);
    if (acquired) {
      legacyDedicatedClients.set(key, client);
      return true;
    }
    await client.end().catch(() => {});
    return false;
  } catch (err) {
    if (client) await client.end().catch(() => {});
    console.error("[AdvisoryLock] Error in acquireAdvisoryLock:", err);
    return false;
  }
}

export async function releaseAdvisoryLock(
  key: number = ADVISORY_LOCK_KEYS.PRICE_SYNC
): Promise<boolean> {
  const client = legacyDedicatedClients.get(key);
  if (!client) return true;

  try {
    await client.query("SELECT pg_advisory_unlock($1) AS released;", [key]).catch(() => {});
    await client.end().catch(() => {});
    legacyDedicatedClients.delete(key);
    return true;
  } catch (err) {
    console.error("[AdvisoryLock] Error in releaseAdvisoryLock:", err);
    legacyDedicatedClients.delete(key);
    return false;
  }
}

/**
 * Resets local dedicated lock connections held by this process.
 * NOTE: pg_advisory_unlock_all() in PostgreSQL only affects the session executing it.
 * It cannot and does not unlock locks owned by other worker sessions.
 * PostgreSQL automatically drops session advisory locks when the holding client disconnects.
 */
export async function resetLocalAdvisoryLocks(): Promise<void> {
  for (const [key, client] of legacyDedicatedClients.entries()) {
    try {
      await client.query("SELECT pg_advisory_unlock($1);", [key]).catch(() => {});
      await client.end().catch(() => {});
    } catch {
      // ignore
    }
  }
  legacyDedicatedClients.clear();
}

/**
 * Backward compatibility alias for legacy callers.
 */
export const forceReleaseAllAdvisoryLocks = resetLocalAdvisoryLocks;

