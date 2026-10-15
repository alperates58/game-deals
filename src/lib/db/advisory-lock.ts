import { prisma } from "./prisma";

// Unique 64-bit integer identifier for the Xbox price sync lock
const SYNC_LOCK_KEY = 884729103;

export async function acquireAdvisoryLock(key: number = SYNC_LOCK_KEY): Promise<boolean> {
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

export async function releaseAdvisoryLock(key: number = SYNC_LOCK_KEY): Promise<boolean> {
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

export async function forceReleaseAllAdvisoryLocks(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock_all();`);
  } catch (error) {
    console.error("[AdvisoryLock] Error force unlocking all:", error);
  }
}

