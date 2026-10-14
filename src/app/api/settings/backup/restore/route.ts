import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { BackupService } from "@/lib/backup/backup-service";
import fs from "fs";

export const maxDuration = 300; // 5 minutes

export async function POST(req: Request) {
  let user;
  try {
    user = await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Yalnızca sistem yöneticisi (OWNER) yetkilidir." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { stagedFilename, confirmation } = body || {};

    if (confirmation !== "RESTORE") {
      return NextResponse.json(
        {
          error:
            "Geri yükleme onayı geçersiz. İşlemi onaylamak için lütfen tam olarak 'RESTORE' yazın.",
        },
        { status: 400 }
      );
    }

    if (!stagedFilename || typeof stagedFilename !== "string") {
      return NextResponse.json({ error: "Geri yüklenecek dosya belirtilmedi." }, { status: 400 });
    }

    const safePath = BackupService.resolveSafePath(stagedFilename);
    if (!fs.existsSync(safePath)) {
      return NextResponse.json({ error: "Geri yüklenecek arşiv dosyası bulunamadı." }, { status: 404 });
    }

    const result = await BackupService.restoreArchive(safePath, user.userId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          preRestoreBackupFilename: result.preRestoreBackupFilename,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      preRestoreBackupFilename: result.preRestoreBackupFilename,
      counts: result.counts,
    });
  } catch (err: any) {
    console.error("[Backup Restore Error]", err);
    return NextResponse.json({ error: `Geri yükleme başarısız: ${err.message}` }, { status: 500 });
  }
}
