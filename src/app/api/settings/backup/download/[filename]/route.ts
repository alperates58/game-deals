import { NextResponse } from "next/server";
import fs from "fs";
import { requireOwner } from "@/lib/auth/session";
import { BackupService } from "@/lib/backup/backup-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Yalnızca sistem yöneticisi (OWNER) yetkilidir." }, { status: 403 });
  }

  const { filename } = await params;

  try {
    const safePath = BackupService.resolveSafePath(filename);
    if (!fs.existsSync(safePath)) {
      return NextResponse.json({ error: "Yedek dosyası bulunamadı." }, { status: 404 });
    }

    const stat = fs.statSync(safePath);
    const fileStream = fs.createReadStream(safePath);

    // Convert Node.js readable stream to Web ReadableStream
    const readable = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stat.size.toString(),
      },
    });
  } catch (err: any) {
    console.error("[Backup Download Error]", err);
    return NextResponse.json({ error: `Dosya indirilemedi: ${err.message}` }, { status: 500 });
  }
}
