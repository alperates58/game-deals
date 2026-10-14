import { prisma } from "../db/prisma";

export interface SystemSettingsData {
  allowRegistration: boolean;
  autoDiscoverSeriesCatalog: boolean;
  catalogDiscoveryIntervalHours: number;
  priceSyncIntervalHours: number;
  metadataRefreshIntervalHours: number;
  relationshipRefreshIntervalHours: number;

  lastCatalogDiscoveryAt?: Date | null;
  lastPriceSyncAt?: Date | null;
  lastMetadataRefreshAt?: Date | null;
  lastRelationshipRefreshAt?: Date | null;

  syncIntervalHours?: number; // legacy compatibility

  autoDiscoverBundleChildren: boolean;
  autoDiscoverRelatedDlc: boolean;
  autoAddRelatedProducts: boolean;

  trackBaseGames: boolean;
  trackBundles: boolean;
  trackDlc: boolean;
  trackExpansions: boolean;
  trackSeasonPasses: boolean;
  trackAddons: boolean;
  trackContentPacks: boolean;
}

export interface SchedulerScheduleInfo {
  autoDiscoverSeriesCatalog: boolean;
  catalogDiscoveryIntervalHours: number;
  priceSyncIntervalHours: number;
  metadataRefreshIntervalHours: number;
  relationshipRefreshIntervalHours: number;
  lastCatalogDiscoveryAt: string | null;
  nextCatalogDiscoveryAt: string | null;
  lastPriceSyncAt: string | null;
  nextPriceSyncAt: string | null;
  isCatalogDiscoveryDue: boolean;
  isPriceSyncDue: boolean;
}

const DEFAULT_SETTINGS: SystemSettingsData = {
  allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  autoDiscoverSeriesCatalog: true,
  catalogDiscoveryIntervalHours: 24,
  priceSyncIntervalHours: 6,
  metadataRefreshIntervalHours: 168,
  relationshipRefreshIntervalHours: 168,
  syncIntervalHours: 6,

  autoDiscoverBundleChildren: true,
  autoDiscoverRelatedDlc: true,
  autoAddRelatedProducts: true,

  trackBaseGames: true,
  trackBundles: true,
  trackDlc: true,
  trackExpansions: true,
  trackSeasonPasses: true,
  trackAddons: true,
  trackContentPacks: false,
};

/**
 * Calculates next schedule timestamps and whether tasks are due.
 */
export function calculateScheduleInfo(settings: {
  autoDiscoverSeriesCatalog: boolean;
  catalogDiscoveryIntervalHours: number;
  priceSyncIntervalHours: number;
  metadataRefreshIntervalHours: number;
  relationshipRefreshIntervalHours: number;
  lastCatalogDiscoveryAt: Date | null;
  lastPriceSyncAt: Date | null;
  now?: Date;
}): SchedulerScheduleInfo {
  const now = settings.now ? settings.now.getTime() : Date.now();

  // Next Catalog Discovery
  let nextCatalogDiscovery: Date | null = null;
  let isCatalogDiscoveryDue = false;

  if (settings.autoDiscoverSeriesCatalog) {
    if (!settings.lastCatalogDiscoveryAt) {
      isCatalogDiscoveryDue = true;
      nextCatalogDiscovery = new Date(now);
    } else {
      const nextTime = settings.lastCatalogDiscoveryAt.getTime() + settings.catalogDiscoveryIntervalHours * 3600000;
      nextCatalogDiscovery = new Date(nextTime);
      isCatalogDiscoveryDue = now >= nextTime;
    }
  }

  // Next Price Sync
  let nextPriceSync: Date | null = null;
  let isPriceSyncDue = false;

  if (!settings.lastPriceSyncAt) {
    isPriceSyncDue = true;
    nextPriceSync = new Date(now);
  } else {
    const nextTime = settings.lastPriceSyncAt.getTime() + settings.priceSyncIntervalHours * 3600000;
    nextPriceSync = new Date(nextTime);
    isPriceSyncDue = now >= nextTime;
  }

  return {
    autoDiscoverSeriesCatalog: settings.autoDiscoverSeriesCatalog,
    catalogDiscoveryIntervalHours: settings.catalogDiscoveryIntervalHours,
    priceSyncIntervalHours: settings.priceSyncIntervalHours,
    metadataRefreshIntervalHours: settings.metadataRefreshIntervalHours,
    relationshipRefreshIntervalHours: settings.relationshipRefreshIntervalHours,
    lastCatalogDiscoveryAt: settings.lastCatalogDiscoveryAt ? settings.lastCatalogDiscoveryAt.toISOString() : null,
    nextCatalogDiscoveryAt: nextCatalogDiscovery ? nextCatalogDiscovery.toISOString() : null,
    lastPriceSyncAt: settings.lastPriceSyncAt ? settings.lastPriceSyncAt.toISOString() : null,
    nextPriceSyncAt: nextPriceSync ? nextPriceSync.toISOString() : null,
    isCatalogDiscoveryDue,
    isPriceSyncDue,
  };
}

/**
 * Gets or initializes singleton system settings.
 */
export async function getSystemSettings() {
  let settings = await prisma.systemSetting.findUnique({
    where: { id: "global" },
  });

  if (!settings) {
    settings = await prisma.systemSetting.create({
      data: {
        id: "global",
        ...DEFAULT_SETTINGS,
      },
    });
  }

  return settings;
}

/**
 * Updates system settings (Server-side OWNER only).
 */
export async function updateSystemSettings(data: Partial<SystemSettingsData>) {
  return prisma.systemSetting.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      ...DEFAULT_SETTINGS,
      ...data,
    },
    update: {
      ...data,
    },
  });
}

/**
 * Checks whether user registration is currently permitted.
 */
export async function isRegistrationAllowed(): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION === "false") {
    return false;
  }
  try {
    const settings = await getSystemSettings();
    return settings.allowRegistration;
  } catch {
    return true;
  }
}
