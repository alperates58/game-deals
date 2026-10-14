import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { runPriceSync } from "@/lib/pricing/sync-runner";
import { runIncrementalDiscovery } from "@/lib/xbox/incremental-discovery";

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
    let action: "PRICE_SYNC" | "CATALOG_DISCOVERY" = "PRICE_SYNC";
    let limit: number | undefined;

    try {
      const body = await req.json();
      if (body?.action === "CATALOG_DISCOVERY") {
        action = "CATALOG_DISCOVERY";
      }
      if (typeof body?.limit === "number") {
        limit = body.limit;
      }
    } catch {
      // Body is optional
    }

    if (action === "CATALOG_DISCOVERY") {
      // Incremental discovery for new Xbox Series X|S games
      const result = await runIncrementalDiscovery({
        triggerSource: "MANUAL_SETTINGS_UI",
        maxPages: limit ? Math.ceil(limit / 25) : 5,
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
