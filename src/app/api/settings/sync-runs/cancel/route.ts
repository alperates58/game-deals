import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";
import { syncProgressTracker } from "@/lib/xbox/sync-progress-tracker";
import { forceReleaseAllAdvisoryLocks } from "@/lib/db/advisory-lock";

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
    const { runId, clearAllStuck } = body;

    // 1. If live progress tracker is currently running, request cancellation
    if (syncProgressTracker.getProgress().isRunning) {
      syncProgressTracker.requestCancel();
    }

    // 2. Release any advisory lock if stopping or clearing
    await forceReleaseAllAdvisoryLocks();

    const now = new Date();

    if (clearAllStuck) {
      // Mark all runs that are RUNNING as PARTIAL
      const updated = await prisma.syncRun.updateMany({
        where: { status: "RUNNING" },
        data: {
          status: "PARTIAL",
          finishedAt: now,
          errorSummary: "Kullanıcı tarafından durduruldu (Takılan görevler temizlendi).",
        },
      });

      syncProgressTracker.reset();

      return NextResponse.json({
        success: true,
        message: `${updated.count} adet takılan tarama görevi durduruldu ve temizlendi.`,
      });
    }

    if (runId) {
      // Mark specific run as PARTIAL
      const existing = await prisma.syncRun.findUnique({
        where: { id: runId },
      });

      if (!existing) {
        return NextResponse.json({ error: "Belirtilen tarama görevi bulunamadı." }, { status: 404 });
      }

      const updated = await prisma.syncRun.update({
        where: { id: runId },
        data: {
          status: "PARTIAL",
          finishedAt: now,
          errorSummary: "Kullanıcı tarafından durduruldu.",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Tarama görevi başarıyla durduruldu.",
        run: updated,
      });
    }

    return NextResponse.json({
      error: "Durdurulacak geçerli bir görev ID'si belirtilmedi.",
    }, { status: 400 });
  } catch (err: any) {
    console.error("[CancelSyncRun Error]", err);
    return NextResponse.json(
      { error: "Görev durdurulamadı: " + err.message },
      { status: 500 }
    );
  }
}
