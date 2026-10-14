import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { runPriceSync } from "@/lib/pricing/sync-runner";

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
    let limit: number | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.limit === "number") {
        limit = body.limit;
      }
    } catch {
      // Body is optional
    }

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
      message: result.message,
      stats: result.stats,
    });
  } catch (err: any) {
    console.error("[SyncNow Route Error]", err);
    return NextResponse.json({ error: "Fiyat senkronizasyonu başlatılamadı." }, { status: 500 });
  }
}
