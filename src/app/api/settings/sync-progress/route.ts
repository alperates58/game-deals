import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { syncProgressTracker } from "@/lib/xbox/sync-progress-tracker";
import { resetStuckJobStates } from "@/lib/scheduler/job-runner";

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
    if (body.action === "FORCE_UNLOCK" || body.action === "RESET_STUCK_STATE") {
      const { repairedJobs } = await resetStuckJobStates();
      syncProgressTracker.reset();
      return NextResponse.json({
        success: true,
        message:
          repairedJobs.length > 0
            ? `İlerleme durumu sıfırlandı ve takılı kalan ${repairedJobs.join(", ")} iş kaydı düzeltildi. (Not: PostgreSQL oturum kilitleri bağlantı kapandığında otomatik serbest bırakılır.)`
            : "İlerleme durumu ve kilitler başarıyla sıfırlandı. (Not: PostgreSQL oturum kilitleri bağlantı kapandığında otomatik serbest bırakılır.)",
        repairedJobs,
      });
    }

    if (body.action === "CANCEL" || body.action === "STOP") {
      syncProgressTracker.requestCancel();
      return NextResponse.json({
        success: true,
        message: "Durdurma talebi iletildi. Mevcut sayfa işlendikten sonra işlem güvenle durdurulacak.",
      });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    console.error("[SyncProgress API Error]", err);
    return NextResponse.json({ error: "İşlem başarısız: " + err.message }, { status: 500 });
  }
}
