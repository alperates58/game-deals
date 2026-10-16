import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  try {
    const user = await requireActiveUser();

    await prisma.telegramConnection.updateMany({
      where: { userId: user.userId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Telegram bağlantısı kesildi." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "İşlem gerçekleştirilemedi." }, { status: 500 });
  }
}
