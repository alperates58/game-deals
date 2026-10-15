import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { syncProgressTracker } from "@/lib/xbox/sync-progress-tracker";
import { forceReleaseAllAdvisoryLocks } from "@/lib/db/advisory-lock";

export async function GET() {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu işlemi yalnızca sistem yöneticisi (OWNER) görüntüleyebilir." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    progress: syncProgressTracker.getProgress(),
  });
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu işlemi yalnızca sistem yöneticisi (OWNER) gerçekleştirebilir." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "FORCE_UNLOCK") {
      await forceReleaseAllAdvisoryLocks();
      syncProgressTracker.reset();
      return NextResponse.json({
        success: true,
        message: "Tüm PostgreSQL advisory kilitleri ve tarama durumu başarıyla sıfırlandı.",
      });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    console.error("[SyncProgress API Error]", err);
    return NextResponse.json({ error: "İşlem başarısız: " + err.message }, { status: 500 });
  }
}
