import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ScheduledJobType } from "@prisma/client";
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system-settings";

export async function GET() {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu endpoint yalnızca sistem yöneticisi (OWNER) tarafından görüntülenebilir." },
      { status: 403 }
    );
  }

  try {
    const settings = await getSystemSettings();
    const states = await prisma.scheduledJobState.findMany({
      orderBy: { jobType: "asc" },
    });

    const jobTypes = [
      ScheduledJobType.PRICE_SYNC,
      ScheduledJobType.CATALOG_DISCOVERY,
      ScheduledJobType.METADATA_REFRESH,
      ScheduledJobType.RELATIONSHIP_REFRESH,
    ];

    // Ensure all 4 job types have a state representation
    const stateMap = new Map(states.map((s) => [s.jobType, s]));
    const jobs = jobTypes.map((type) => {
      const state = stateMap.get(type);
      let intervalHours = 24;
      if (type === ScheduledJobType.CATALOG_DISCOVERY) intervalHours = settings.catalogDiscoveryIntervalHours;
      if (type === ScheduledJobType.PRICE_SYNC) intervalHours = settings.priceSyncIntervalHours;
      if (type === ScheduledJobType.METADATA_REFRESH) intervalHours = settings.metadataRefreshIntervalHours;
      if (type === ScheduledJobType.RELATIONSHIP_REFRESH) intervalHours = settings.relationshipRefreshIntervalHours;

      return {
        jobType: type,
        enabled: state ? state.enabled : true,
        intervalHours,
        lastStartedAt: state?.lastStartedAt ? state.lastStartedAt.toISOString() : null,
        lastFinishedAt: state?.lastFinishedAt ? state.lastFinishedAt.toISOString() : null,
        lastSuccessAt: state?.lastSuccessAt ? state.lastSuccessAt.toISOString() : null,
        nextRunAt: state?.nextRunAt ? state.nextRunAt.toISOString() : null,
        status: state?.lastStatus || "IDLE",
        durationMs: state?.lastDurationMs ?? null,
        itemsProcessed: state?.lastItemsProcessed ?? 0,
        itemsAdded: state?.lastItemsAdded ?? 0,
        itemsChanged: state?.lastItemsChanged ?? 0,
        errorCount: state?.lastErrorCount ?? 0,
        count429: state?.last429Count ?? 0,
        count5xx: state?.last5xxCount ?? 0,
        errorSummary: state?.lastErrorSummary ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      jobs,
      settings: {
        autoDiscoverSeriesCatalog: settings.autoDiscoverSeriesCatalog,
        catalogDiscoveryIntervalHours: settings.catalogDiscoveryIntervalHours,
        priceSyncIntervalHours: settings.priceSyncIntervalHours,
        metadataRefreshIntervalHours: settings.metadataRefreshIntervalHours,
        relationshipRefreshIntervalHours: settings.relationshipRefreshIntervalHours,
      },
    });
  } catch (err: any) {
    console.error("[ScheduledJobs GET Error]", err);
    return NextResponse.json({ error: "Zamanlanmış işler listelenemedi." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu endpoint yalnızca sistem yöneticisi (OWNER) tarafından değiştirilebilir." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { jobType, enabled, intervalHours } = body;

    if (!jobType || !Object.values(ScheduledJobType).includes(jobType)) {
      return NextResponse.json({ error: "Geçersiz iş türü (jobType)." }, { status: 400 });
    }

    // 1. Update enabled toggle if provided
    if (typeof enabled === "boolean") {
      await prisma.scheduledJobState.upsert({
        where: { jobType },
        create: {
          jobType,
          enabled,
        },
        update: {
          enabled,
        },
      });
    }

    // 2. Update interval in SystemSetting if provided
    if (typeof intervalHours === "number" && intervalHours >= 1) {
      const updateData: any = {};
      if (jobType === ScheduledJobType.CATALOG_DISCOVERY) updateData.catalogDiscoveryIntervalHours = intervalHours;
      if (jobType === ScheduledJobType.PRICE_SYNC) updateData.priceSyncIntervalHours = intervalHours;
      if (jobType === ScheduledJobType.METADATA_REFRESH) updateData.metadataRefreshIntervalHours = intervalHours;
      if (jobType === ScheduledJobType.RELATIONSHIP_REFRESH) updateData.relationshipRefreshIntervalHours = intervalHours;

      await updateSystemSettings(updateData);
    }

    return NextResponse.json({
      success: true,
      message: `${jobType} ayarları güncellendi.`,
    });
  } catch (err: any) {
    console.error("[ScheduledJobs POST Error]", err);
    return NextResponse.json({ error: "Ayar güncellenemedi." }, { status: 500 });
  }
}
