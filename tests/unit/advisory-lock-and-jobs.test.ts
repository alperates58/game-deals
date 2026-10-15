import { describe, it, expect } from "vitest";
import { ADVISORY_LOCK_KEYS } from "@/lib/db/advisory-lock";
import { sanitizeErrorMessage } from "@/lib/scheduler/job-runner";
import { calculateScheduleInfo } from "@/lib/settings/system-settings";

describe("Autonomous Operations & Advisory Lock Architecture (FAZ 1.3B)", () => {
  it("should define distinct advisory lock keys for all 4 jobs plus global Xbox lock", () => {
    expect(ADVISORY_LOCK_KEYS.GLOBAL_XBOX_API).toBe(884729100);
    expect(ADVISORY_LOCK_KEYS.CATALOG_DISCOVERY).toBe(884729101);
    expect(ADVISORY_LOCK_KEYS.PRICE_SYNC).toBe(884729102);
    expect(ADVISORY_LOCK_KEYS.METADATA_REFRESH).toBe(884729103);
    expect(ADVISORY_LOCK_KEYS.RELATIONSHIP_REFRESH).toBe(884729104);

    // All keys must be unique
    const values = Object.values(ADVISORY_LOCK_KEYS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("should sanitize error messages and redact database passwords, tokens, and secrets", () => {
    const rawErrorWithDbUrl =
      "Error: connect ECONNREFUSED postgresql://super_admin:P@ssw0rd123!@10.0.0.5:5432/gamedeals?sslmode=require";
    const sanitizedDb = sanitizeErrorMessage(rawErrorWithDbUrl);

    expect(sanitizedDb).not.toContain("P@ssw0rd123!");
    expect(sanitizedDb).not.toContain("super_admin");
    expect(sanitizedDb).toContain("postgresql://[REDACTED_CREDENTIALS]@[REDACTED_HOST]/[DB]");

    const rawErrorWithToken = "HTTP 401: Unauthorized access with bearer=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const sanitizedToken = sanitizeErrorMessage(rawErrorWithToken);
    expect(sanitizedToken).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(sanitizedToken).toContain("bearer=[REDACTED]");
  });

  it("should correctly compute isDue based on interval and last run timestamps", () => {
    const now = new Date("2026-10-15T12:00:00.000Z");

    // Case 1: Never run before -> Must be due
    const schedNeverRun = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: true,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: null,
      lastPriceSyncAt: null,
      now,
    });
    expect(schedNeverRun.isCatalogDiscoveryDue).toBe(true);
    expect(schedNeverRun.isPriceSyncDue).toBe(true);

    // Case 2: Ran 2 hours ago with 6h interval -> NOT due
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
    const schedRecent = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: true,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: twoHoursAgo,
      lastPriceSyncAt: twoHoursAgo,
      now,
    });
    expect(schedRecent.isPriceSyncDue).toBe(false);
    expect(schedRecent.isCatalogDiscoveryDue).toBe(false);

    // Case 3: Ran 7 hours ago with 6h interval -> DUE
    const sevenHoursAgo = new Date(now.getTime() - 7 * 3600 * 1000);
    const schedDue = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: true,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: twoHoursAgo,
      lastPriceSyncAt: sevenHoursAgo,
      now,
    });
    expect(schedDue.isPriceSyncDue).toBe(true);
    expect(schedDue.isCatalogDiscoveryDue).toBe(false);
  });

  it("should respect autoDiscoverSeriesCatalog master toggle", () => {
    const now = new Date();
    const schedDisabled = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: false,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: null,
      lastPriceSyncAt: null,
      now,
    });

    expect(schedDisabled.autoDiscoverSeriesCatalog).toBe(false);
    expect(schedDisabled.isCatalogDiscoveryDue).toBe(false);
  });
});
