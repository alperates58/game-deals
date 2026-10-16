import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProductClass } from "@prisma/client";
import { logAdminAudit } from "@/lib/audit/audit-logger";

const OverrideSchema = z.object({
  title: z.string().trim().min(1).optional().nullable(),
  developer: z.string().trim().optional().nullable(),
  publisher: z.string().trim().optional().nullable(),
  franchise: z.string().trim().optional().nullable(),
  productClass: z.nativeEnum(ProductClass).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional().nullable(),
  reason: z.string().trim().min(3, "Manuel ezme gerekçesi zorunludur"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireOwner();
    const { id } = await params;
    const body = await req.json();

    const validated = OverrideSchema.parse(body);

    const game = await prisma.game.findUnique({
      where: { id },
      include: { manualOverride: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Oyun bulunamadı" }, { status: 404 });
    }

    const previousData = game.manualOverride ? { ...game.manualOverride } : null;

    const override = await prisma.gameManualOverride.upsert({
      where: { gameId: id },
      create: {
        gameId: id,
        title: validated.title,
        developer: validated.developer,
        publisher: validated.publisher,
        franchise: validated.franchise,
        productClass: validated.productClass,
        imageUrl: validated.imageUrl || null,
        isActive: validated.isActive,
        reason: validated.reason,
        updatedByUserId: owner.userId,
      },
      update: {
        title: validated.title,
        developer: validated.developer,
        publisher: validated.publisher,
        franchise: validated.franchise,
        productClass: validated.productClass,
        imageUrl: validated.imageUrl || null,
        isActive: validated.isActive,
        reason: validated.reason,
        updatedByUserId: owner.userId,
      },
    });

    await logAdminAudit({
      actorId: owner.userId,
      actorEmail: owner.email,
      action: "UPDATE_MANUAL_OVERRIDE",
      entityType: "Game",
      entityId: id,
      details: {
        gameTitle: game.title,
        reason: validated.reason,
        appliedChanges: validated,
        previousOverride: previousData,
      },
    });

    return NextResponse.json({ success: true, override });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Geçersiz veri" }, { status: 400 });
    }
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Admin catalog override error:", error);
    return NextResponse.json({ error: "Manuel ezme uygulanamadı" }, { status: 500 });
  }
}
