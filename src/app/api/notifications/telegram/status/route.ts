import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth/session";
import { isTelegramConfigured } from "@/lib/notifications/telegram-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireActiveUser();

    const connection = await prisma.telegramConnection.findUnique({
      where: { userId: session.userId },
      select: {
        isActive: true,
        telegramUsername: true,
        displayName: true,
        linkedAt: true,
      },
    });

    const isConnected = Boolean(connection && connection.isActive);

    return NextResponse.json({
      success: true,
      connected: isConnected,
      telegram: connection,
      isTelegramConfigured: isTelegramConfigured(),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmalısınız" }, { status: 401 });
    }
    return NextResponse.json({ error: "Telegram durumu sorgulanamadı" }, { status: 500 });
  }
}
