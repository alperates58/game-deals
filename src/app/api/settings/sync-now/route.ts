import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { runScheduledJob } from "@/lib/scheduler/job-runner";
import { ScheduledJobType } from "@prisma/client";
import { forceReleaseAllAdvisoryLocks } from "@/lib/db/advisory-lock";
import { syncProgressTracker } from "@/lib/xbox/sync-progress-tracker";

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu işlemi yalnızca sistem yöneticisi (OWNER) tetikleyebilir." },
      { status: 403 }
    );
  }

  try {
    let action:
      | "PRICE_SYNC"
      | "CATALOG_DISCOVERY"
      | "FULL_CATALOG_CRAWL"
      | "METADATA_REFRESH"
      | "RELATIONSHIP_REFRESH"
      | "FORCE_UNLOCK" = "PRICE_SYNC";
    let limit: number | undefined;
    let maxPages: number | undefined;

    try {
      const body = await req.json();
      if (body?.action) {
        action = body.action;
      }
      if (typeof body?.limit === "number") {
        limit = body.limit;
      }
      if (typeof body?.maxPages === "number") {
        maxPages = body.maxPages;
      }
    } catch {
      // Body is optional
    }

    if (action === "FORCE_UNLOCK") {
      await forceReleaseAllAdvisoryLocks();
      syncProgressTracker.reset();
      return NextResponse.json({
        success: true,
        message: "Tüm PostgreSQL kilitleri ve senkronizasyon durumu başarıyla sıfırlandı.",
      });
    }

    if (action === "FULL_CATALOG_CRAWL") {
      if (syncProgressTracker.getProgress().isRunning) {
        return NextResponse.json(
          { error: "Zaten aktif bir tarama veya senkronizasyon yürütülüyor.", locked: true },
          { status: 409 }
        );
      }

      // Launch full store crawl in background
      runScheduledJob(ScheduledJobType.CATALOG_DISCOVERY, "MANUAL_SETTINGS_UI", {
        fullCrawl: true,
      }).catch((err) => {
        console.error("[FullCatalogCrawl Error]", err);
      });

      return NextResponse.json({
        success: true,
        action: "FULL_CATALOG_CRAWL",
        message: "🚀 Tüm Xbox (Series X|S & Xbox One) mağaza taraması arka planda başlatıldı. İlerleme panelinden anlık takip edebilirsiniz.",
      });
    }

    if (action === "CATALOG_DISCOVERY") {
      const targetPages = maxPages || (limit ? Math.ceil(limit / 25) : 40);

      // If scanning 80 or more pages, run in background
      if (targetPages >= 80) {
        if (syncProgressTracker.getProgress().isRunning) {
          return NextResponse.json(
            { error: "Zaten aktif bir tarama yürütülüyor.", locked: true },
            { status: 409 }
          );
        }

        runScheduledJob(ScheduledJobType.CATALOG_DISCOVERY, "MANUAL_SETTINGS_UI", {
          maxPages: targetPages,
        }).catch((err) => {
          console.error("[CatalogDiscovery Background Error]", err);
        });

        return NextResponse.json({
          success: true,
          action: "CATALOG_DISCOVERY",
          message: `${targetPages} sayfalık katalog taraması arka planda başlatıldı. İlerleme panelinden anlık takip edebilirsiniz.`,
        });
      }

      const result = await runScheduledJob(ScheduledJobType.CATALOG_DISCOVERY, "MANUAL_SETTINGS_UI", {
        maxPages: targetPages,
      });

      if (!result.success && result.locked) {
        return NextResponse.json({ error: result.message, locked: true }, { status: 409 });
      }

      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "CATALOG_DISCOVERY",
        message: result.message,
      });
    }

    if (action === "METADATA_REFRESH") {
      const result = await runScheduledJob(ScheduledJobType.METADATA_REFRESH, "MANUAL_SETTINGS_UI", { limit });
      if (!result.success && result.locked) {
        return NextResponse.json({ error: result.message, locked: true }, { status: 409 });
      }
      return NextResponse.json({
        success: result.success,
        action: "METADATA_REFRESH",
        message: result.message,
      });
    }

    if (action === "RELATIONSHIP_REFRESH") {
      const result = await runScheduledJob(ScheduledJobType.RELATIONSHIP_REFRESH, "MANUAL_SETTINGS_UI", { limit });
      if (!result.success && result.locked) {
        return NextResponse.json({ error: result.message, locked: true }, { status: 409 });
      }
      return NextResponse.json({
        success: result.success,
        action: "RELATIONSHIP_REFRESH",
        message: result.message,
      });
    }

    // Default: Price synchronization
    const result = await runScheduledJob(ScheduledJobType.PRICE_SYNC, "MANUAL_SETTINGS_UI", { limit });

    if (!result.success && result.locked) {
      return NextResponse.json({ error: result.message, locked: true }, { status: 409 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "PRICE_SYNC",
      message: result.message,
    });
  } catch (err: any) {
    console.error("[SyncNow Route Error]", err);
    return NextResponse.json({ error: "İşlem başlatılamadı." }, { status: 500 });
  }
}
