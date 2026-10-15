import { describe, it, expect, vi } from "vitest";
import {
  withXboxJobLocks,
  ADVISORY_LOCK_KEYS,
  ILockClient,
} from "@/lib/db/advisory-lock";
import {
  reconcileStaleRunningJobs,
  resetStuckJobStates,
  STALE_JOB_TIMEOUT_MS,
} from "@/lib/scheduler/job-runner";
import { prisma } from "@/lib/db/prisma";
import { ScheduledJobType, ScheduledJobStatus } from "@prisma/client";

/**
 * Mock PostgreSQL Client simulating dedicated connection lifecycle and query tracking.
 */
class MockLockClient implements ILockClient {
  public isConnected = false;
  public isEnded = false;
  public queries: Array<{ text: string; values?: any[] }> = [];
  public customHandler?: (text: string, values?: any[]) => { rows: any[] };

  constructor(customHandler?: (text: string, values?: any[]) => { rows: any[] }) {
    this.customHandler = customHandler;
  }

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async query(text: string, values?: any[]): Promise<{ rows: any[] }> {
    this.queries.push({ text, values });
    if (this.customHandler) {
      return this.customHandler(text, values);
    }
    if (text.includes("pg_try_advisory_lock")) {
      return { rows: [{ acquired: true }] };
    }
    if (text.includes("pg_advisory_unlock")) {
      return { rows: [{ released: true }] };
    }
    return { rows: [] };
  }

  async end(): Promise<void> {
    this.isEnded = true;
  }
}

describe("PostgreSQL Advisory Lock Connection Safety & Scoped Lifecycle (FAZ 1.3B Hotfix)", () => {
  it("should acquire and release both locks on the EXACT SAME dedicated client connection", async () => {
    const mockClient = new MockLockClient();
    let taskExecuted = false;

    const result = await withXboxJobLocks(
      "PRICE_SYNC",
      async () => {
        taskExecuted = true;
        return { itemsSynced: 42 };
      },
      { clientFactory: () => mockClient }
    );

    // 1. Task must execute successfully
    expect(taskExecuted).toBe(true);
    expect(result.acquired).toBe(true);
    if (result.acquired) {
      expect(result.code).toBe("ACQUIRED");
      expect(result.data).toEqual({ itemsSynced: 42 });
    }

    // 2. Client connection lifecycle
    expect(mockClient.isConnected).toBe(true);
    expect(mockClient.isEnded).toBe(true);

    // 3. Exact query sequence on the SAME connection
    expect(mockClient.queries.length).toBe(4);

    // Step A: Acquire Job lock
    expect(mockClient.queries[0].text).toContain("pg_try_advisory_lock");
    expect(mockClient.queries[0].values).toEqual([ADVISORY_LOCK_KEYS.PRICE_SYNC]);

    // Step B: Acquire Global Xbox API lock
    expect(mockClient.queries[1].text).toContain("pg_try_advisory_lock");
    expect(mockClient.queries[1].values).toEqual([ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API]);

    // Step C: Release Global Xbox API lock in finally
    expect(mockClient.queries[2].text).toContain("pg_advisory_unlock");
    expect(mockClient.queries[2].values).toEqual([ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API]);

    // Step D: Release Job lock in finally
    expect(mockClient.queries[3].text).toContain("pg_advisory_unlock");
    expect(mockClient.queries[3].values).toEqual([ADVISORY_LOCK_KEYS.PRICE_SYNC]);
  });

  it("should close connection immediately on job lock failure without querying global lock", async () => {
    const mockClient = new MockLockClient((text) => {
      if (text.includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: false }] };
      }
      return { rows: [] };
    });

    let taskExecuted = false;
    const result = await withXboxJobLocks(
      "CATALOG_DISCOVERY",
      async () => {
        taskExecuted = true;
        return "ok";
      },
      { clientFactory: () => mockClient }
    );

    expect(taskExecuted).toBe(false);
    expect(result.acquired).toBe(false);
    expect(result.code).toBe("ALREADY_RUNNING");
    expect(mockClient.isEnded).toBe(true);

    // Only 1 query attempted: job lock. Global lock must NOT have been called.
    expect(mockClient.queries.length).toBe(1);
    expect(mockClient.queries[0].values).toEqual([ADVISORY_LOCK_KEYS.CATALOG_DISCOVERY]);
  });

  it("should release job lock on the SAME connection and close when global lock fails", async () => {
    const mockClient = new MockLockClient((text, values) => {
      if (text.includes("pg_try_advisory_lock")) {
        // Job lock succeeds, but global lock fails
        if (values?.[0] === ADVISORY_LOCK_KEYS.METADATA_REFRESH) {
          return { rows: [{ acquired: true }] };
        }
        if (values?.[0] === ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API) {
          return { rows: [{ acquired: false }] };
        }
      }
      return { rows: [{ released: true }] };
    });

    let taskExecuted = false;
    const result = await withXboxJobLocks(
      "METADATA_REFRESH",
      async () => {
        taskExecuted = true;
        return "ok";
      },
      { clientFactory: () => mockClient }
    );

    expect(taskExecuted).toBe(false);
    expect(result.acquired).toBe(false);
    expect(result.code).toBe("GLOBAL_XBOX_API_BUSY");
    expect(mockClient.isEnded).toBe(true);

    // Queries:
    // 1. acquire METADATA_REFRESH
    // 2. acquire GLOBAL_XBOX_API -> fails
    // 3. release METADATA_REFRESH on SAME connection
    expect(mockClient.queries.length).toBe(3);
    expect(mockClient.queries[0].values).toEqual([ADVISORY_LOCK_KEYS.METADATA_REFRESH]);
    expect(mockClient.queries[1].values).toEqual([ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API]);
    expect(mockClient.queries[2].text).toContain("pg_advisory_unlock");
    expect(mockClient.queries[2].values).toEqual([ADVISORY_LOCK_KEYS.METADATA_REFRESH]);
  });

  it("should guarantee releasing both locks in finally when task throws an unhandled error", async () => {
    const mockClient = new MockLockClient();

    const result = await withXboxJobLocks(
      "RELATIONSHIP_REFRESH",
      async () => {
        throw new Error("Simulated upstream network breakdown");
      },
      { clientFactory: () => mockClient }
    );

    expect(result.acquired).toBe(false);
    if (!result.acquired) {
      expect(result.code).toBe("ERROR");
      expect(result.reason).toContain("Simulated upstream network breakdown");
    }

    // Both locks must have been released in finally
    expect(mockClient.isEnded).toBe(true);
    expect(mockClient.queries.length).toBe(4);
    expect(mockClient.queries[2].text).toContain("pg_advisory_unlock");
    expect(mockClient.queries[2].values).toEqual([ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API]);
    expect(mockClient.queries[3].text).toContain("pg_advisory_unlock");
    expect(mockClient.queries[3].values).toEqual([ADVISORY_LOCK_KEYS.RELATIONSHIP_REFRESH]);
  });

  it("should never report COMPLETED on connection failure and return structured ERROR", async () => {
    const brokenClient: ILockClient = {
      connect: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
      },
      query: async () => ({ rows: [] }),
      end: async () => {},
    };

    const result = await withXboxJobLocks(
      "PRICE_SYNC",
      async () => {
        return "completed";
      },
      { clientFactory: () => brokenClient }
    );

    expect(result.acquired).toBe(false);
    if (!result.acquired) {
      expect(result.code).toBe("ERROR");
      expect(result.reason).toContain("connect ECONNREFUSED");
    }
  });

  it("should reconcile stale RUNNING jobs that exceeded the timeout threshold", async () => {
    const staleStartTime = new Date(Date.now() - (STALE_JOB_TIMEOUT_MS + 60000));

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValueOnce({
      id: "singleton",
      priceSyncIntervalHours: 6,
    } as any);

    // Mock prisma.scheduledJobState.findMany
    vi.spyOn(prisma.scheduledJobState, "findMany").mockResolvedValueOnce([
      {
        id: "stale-job-1",
        jobType: ScheduledJobType.PRICE_SYNC,
        enabled: true,
        lastStatus: ScheduledJobStatus.RUNNING,
        lastStartedAt: staleStartTime,
        lastFinishedAt: null,
        lastSuccessAt: null,
        nextRunAt: null,
        lastErrorSummary: null,
        lastDurationMs: null,
        lastItemsProcessed: 0,
        lastItemsAdded: 0,
        lastItemsChanged: 0,
        lastErrorCount: 0,
        last429Count: 0,
        last5xxCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const updateSpy = vi
      .spyOn(prisma.scheduledJobState, "update")
      .mockResolvedValueOnce({} as any);

    const reconciled = await reconcileStaleRunningJobs();

    expect(reconciled).toEqual([ScheduledJobType.PRICE_SYNC]);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stale-job-1" },
        data: expect.objectContaining({
          lastStatus: ScheduledJobStatus.FAILED,
          lastErrorSummary: expect.stringContaining("Stale RUNNING reconciled"),
        }),
      })
    );
  });

  it("should safely reset stuck states without claiming impossible global pg unlock", async () => {
    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValueOnce({
      id: "singleton",
      catalogDiscoveryIntervalHours: 24,
    } as any);

    vi.spyOn(prisma.scheduledJobState, "findMany").mockResolvedValueOnce([
      {
        id: "stuck-1",
        jobType: ScheduledJobType.CATALOG_DISCOVERY,
        lastStatus: ScheduledJobStatus.RUNNING,
      } as any,
    ]);

    const updateSpy = vi
      .spyOn(prisma.scheduledJobState, "update")
      .mockResolvedValueOnce({} as any);

    const result = await resetStuckJobStates();

    expect(result.repairedJobs).toEqual([ScheduledJobType.CATALOG_DISCOVERY]);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stuck-1" },
        data: expect.objectContaining({
          lastStatus: ScheduledJobStatus.FAILED,
          lastErrorSummary: expect.stringContaining("Stuck State Reset"),
        }),
      })
    );
  });
});
