import { describe, it, expect } from "vitest";
import { calculateScheduleInfo } from "../../src/lib/settings/system-settings";
import { BackupService, parseDatabaseUrl, BACKUP_DIR } from "../../src/lib/backup/backup-service";
import path from "path";

describe("Scheduler Calculation Unit Tests", () => {
  it("should calculate catalog discovery and price sync as due when timestamps are null", () => {
    const info = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: true,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: null,
      lastPriceSyncAt: null,
    });

    expect(info.isCatalogDiscoveryDue).toBe(true);
    expect(info.isPriceSyncDue).toBe(true);
  });

  it("should calculate correct next schedule when last execution is recent", () => {
    const fixedNow = new Date("2026-10-15T12:00:00.000Z");
    const lastDiscovery = new Date("2026-10-15T10:00:00.000Z"); // 2 hours ago
    const lastPriceSync = new Date("2026-10-15T11:00:00.000Z"); // 1 hour ago

    const info = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: true,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: lastDiscovery,
      lastPriceSyncAt: lastPriceSync,
      now: fixedNow,
    });

    expect(info.isCatalogDiscoveryDue).toBe(false);
    expect(info.isPriceSyncDue).toBe(false);
    // Next discovery should be 2026-10-16T10:00:00.000Z
    expect(info.nextCatalogDiscoveryAt).toBe("2026-10-16T10:00:00.000Z");
    // Next price sync should be 2026-10-15T17:00:00.000Z
    expect(info.nextPriceSyncAt).toBe("2026-10-15T17:00:00.000Z");
  });

  it("should respect autoDiscoverSeriesCatalog disabled setting", () => {
    const info = calculateScheduleInfo({
      autoDiscoverSeriesCatalog: false,
      catalogDiscoveryIntervalHours: 24,
      priceSyncIntervalHours: 6,
      metadataRefreshIntervalHours: 168,
      relationshipRefreshIntervalHours: 168,
      lastCatalogDiscoveryAt: null,
      lastPriceSyncAt: null,
    });

    expect(info.isCatalogDiscoveryDue).toBe(false);
    expect(info.nextCatalogDiscoveryAt).toBeNull();
    expect(info.isPriceSyncDue).toBe(true); // price sync still due
  });
});

describe("Backup Security & Path Traversal Unit Tests", () => {
  it("should safely resolve filenames inside BACKUP_DIR", () => {
    const filename = "game-deals-2026-10-14-120000.dump";
    const resolved = BackupService.resolveSafePath(filename);

    expect(resolved.startsWith(BACKUP_DIR)).toBe(true);
    expect(path.basename(resolved)).toBe(filename);
  });

  it("should prevent directory traversal attacks (basename isolation)", () => {
    const maliciousName = "../../etc/passwd";
    const resolved = BackupService.resolveSafePath(maliciousName);

    // path.basename isolates it to 'passwd', resolving strictly inside BACKUP_DIR
    expect(resolved.startsWith(BACKUP_DIR)).toBe(true);
    expect(path.basename(resolved)).toBe("passwd");
  });

  it("should parse DATABASE_URL correctly without leaking password in parameters", () => {
    const url = "postgresql://myuser:secretpass@127.0.0.1:5433/customdb?schema=public";
    const parsed = parseDatabaseUrl(url);

    expect(parsed.user).toBe("myuser");
    expect(parsed.password).toBe("secretpass");
    expect(parsed.host).toBe("127.0.0.1");
    expect(parsed.port).toBe("5433");
    expect(parsed.database).toBe("customdb");
  });
});
