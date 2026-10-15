import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { runPriceSync } from "@/lib/pricing/sync-runner";
import { runIncrementalDiscovery } from "@/lib/xbox/incremental-discovery";
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
    let action: "PRICE_SYNC" | "CATALOG_DISCOVERY" | "FORCE_UNLOCK" = "PRICE_SYNC";
    let limit: number | undefined;
    let maxPages: number | undefined;

    try {
      const body = await req.json();
      if (body?.action === "CATALOG_DISCOVERY") {
        action = "CATALOG_DISCOVERY";
      } else if (body?.action === "FORCE_UNLOCK") {
        action = "FORCE_UNLOCK";
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

    if (action === "CATALOG_DISCOVERY") {
      const targetPages = maxPages || (limit ? Math.ceil(limit / 25) : 40);
      // Incremental discovery for new Xbox Series X|S games
      const result = await runIncrementalDiscovery({
        triggerSource: "MANUAL_SETTINGS_UI",
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
        stats: result.stats,
      });
    }

    // Default: Price synchronization
    const result = await runPriceSync({ limit, triggerSource: "MANUAL_SETTINGS_UI" });

    if (!result.success && result.locked) {
      return NextResponse.json(
        { error: result.message, locked: true },
        { status: 409 }
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "PRICE_SYNC",
      message: result.message,
      stats: result.stats,
    });
  } catch (err: any) {
    console.error("[SyncNow Route Error]", err);
    return NextResponse.json({ error: "İşlem başlatılamadı." }, { status: 500 });
  }
}
