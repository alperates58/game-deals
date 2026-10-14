import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { BackupService } from "@/lib/backup/backup-service";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Yalnızca sistem yöneticisi (OWNER) yetkilidir." }, { status: 403 });
  }

  const { id } = await params;

  try {
    await BackupService.deleteBackup(id);
    return NextResponse.json({ success: true, message: "Yedek dosyası silindi." });
  } catch (err: any) {
    console.error("[Backup DELETE Error]", err);
    return NextResponse.json({ error: `Yedek silinemedi: ${err.message}` }, { status: 500 });
  }
}
