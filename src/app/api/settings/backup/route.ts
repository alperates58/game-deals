import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { BackupService } from "@/lib/backup/backup-service";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Yalnızca sistem yöneticisi (OWNER) erişebilir." }, { status: 403 });
  }

  try {
    const backups = await BackupService.listBackups();

    // Table counts for overview
    const [gameCount, priceHistoryCount, relationCount, userCount] = await Promise.all([
      prisma.game.count(),
      prisma.priceHistory.count(),
      prisma.gameRelation.count(),
      prisma.user.count(),
    ]);

    return NextResponse.json({
      backups,
      currentCounts: {
        gameCount,
        priceHistoryCount,
        relationCount,
        userCount,
      },
    });
  } catch (err: any) {
    console.error("[Backup GET Error]", err);
    return NextResponse.json({ error: "Yedek listesi alınamadı." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Yalnızca sistem yöneticisi (OWNER) yedek oluşturabilir." }, { status: 403 });
  }

  try {
    let mode: "FULL" | "CATALOG" = "FULL";
    try {
      const body = await req.json();
      if (body?.mode === "CATALOG") {
        mode = "CATALOG";
      }
    } catch {
      // Body is optional, default to FULL
    }

    const backup = await BackupService.createBackup({
      mode,
      initiatedByUserId: user.userId,
    });

    return NextResponse.json({
      success: true,
      message: `${mode === "CATALOG" ? "Katalog" : "Tam"} veritabanı yedeği başarıyla oluşturuldu.`,
      backup,
    });
  } catch (err: any) {
    console.error("[Backup POST Error]", err);
    return NextResponse.json(
      { error: `Yedek oluşturulamadı: ${err.message}` },
      { status: 500 }
    );
  }
}
