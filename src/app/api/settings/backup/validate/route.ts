import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireOwner } from "@/lib/auth/session";
import { BackupService, BACKUP_DIR } from "@/lib/backup/backup-service";

export const maxDuration = 60; // 60 seconds

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Yalnızca sistem yöneticisi (OWNER) yetkilidir." }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Lütfen bir yedek dosyası (.dump veya .backup) yükleyin." }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (ext !== ".dump" && ext !== ".backup") {
      return NextResponse.json(
        { error: "Yalnızca .dump veya .backup uzantılı PostgreSQL custom-format dosyaları desteklenmektedir." },
        { status: 400 }
      );
    }

    // Size limit check (e.g. 500 MB max)
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Yedek dosyası boyutu çok büyük (Maksimum 500 MB)." },
        { status: 400 }
      );
    }

    // Generate safe quarantine filename
    const safeFilename = BackupService.generateFilename("upload-staging");
    const safePath = path.resolve(BACKUP_DIR, safeFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(safePath, buffer);

    // Inspect archive TOC with pg_restore --list
    const inspection = await BackupService.inspectArchive(safePath);

    if (!inspection.valid) {
      fs.unlinkSync(safePath);
      return NextResponse.json(
        {
          valid: false,
          error: `Geçersiz arşiv dosyası: ${inspection.error || "PostgreSQL custom formatı doğrulanamadı."}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      stagedFilename: safeFilename,
      originalFilename: originalName,
      sizeBytes: file.size,
      format: inspection.format,
      entryCount: inspection.entryCount,
      tables: inspection.tables,
    });
  } catch (err: any) {
    console.error("[Backup Validate Error]", err);
    return NextResponse.json({ error: `Yedek doğrulanamadı: ${err.message}` }, { status: 500 });
  }
}
