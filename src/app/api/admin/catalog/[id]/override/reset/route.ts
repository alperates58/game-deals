import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { logAdminAudit } from "@/lib/audit/audit-logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireOwner();
    const { id } = await params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: { manualOverride: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Oyun bulunamadı" }, { status: 404 });
    }

    if (!game.manualOverride) {
      return NextResponse.json({ message: "Bu oyunda aktif manuel ezme bulunmuyor" });
    }

    const previousOverride = { ...game.manualOverride };

    await prisma.gameManualOverride.delete({
      where: { gameId: id },
    });

    await logAdminAudit({
      actorId: owner.userId,
      actorEmail: owner.email,
      action: "RESET_MANUAL_OVERRIDE",
      entityType: "Game",
      entityId: id,
      details: {
        gameTitle: game.title,
        deletedOverride: previousOverride,
      },
    });

    return NextResponse.json({ success: true, message: "Manuel ezmeler kaldırıldı ve mağaza verilerine dönüldü." });
  } catch (error: any) {
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Reset catalog override error:", error);
    return NextResponse.json({ error: "Ezme sıfırlanamadı" }, { status: 500 });
  }
}
