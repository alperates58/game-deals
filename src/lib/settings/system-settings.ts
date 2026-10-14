import { prisma } from "../db/prisma";

export interface SystemSettingsData {
  allowRegistration: boolean;
  syncIntervalHours: number;
  autoDiscoverPopular: boolean;
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

const DEFAULT_SETTINGS: SystemSettingsData = {
  allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  syncIntervalHours: 6,
  autoDiscoverPopular: true,
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
  const settings = await getSystemSettings();
  return settings.allowRegistration;
}
