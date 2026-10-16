import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth/session";

const MarkReadSchema = z.object({
  notificationId: z.string().optional(),
  all: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireActiveUser();
    const body = await req.json().catch(() => ({}));
    const parsed = MarkReadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz istek verisi." }, { status: 400 });
    }

    const { notificationId, all } = parsed.data;
    const now = new Date();

    if (all) {
      await prisma.userNotification.updateMany({
        where: { userId: session.userId, readAt: null },
        data: { readAt: now },
      });
      return NextResponse.json({ success: true, message: "Tüm bildirimler okundu olarak işaretlendi." });
    }

    if (notificationId) {
      await prisma.userNotification.updateMany({
        where: { id: notificationId, userId: session.userId },
        data: { readAt: now },
      });
      return NextResponse.json({ success: true, message: "Bildirim okundu olarak işaretlendi." });
    }

    return NextResponse.json({ error: "Bildirim ID veya tümü belirtilmelidir." }, { status: 400 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "İşlem gerçekleştirilemedi." }, { status: 500 });
  }
}
