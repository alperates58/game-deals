import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system-settings";

const UpdateSettingsSchema = z.object({
  allowRegistration: z.boolean().optional(),
  syncIntervalHours: z.number().int().min(1).max(72).optional(),
  autoDiscoverPopular: z.boolean().optional(),
  autoDiscoverBundleChildren: z.boolean().optional(),
  autoDiscoverRelatedDlc: z.boolean().optional(),
  autoAddRelatedProducts: z.boolean().optional(),
  trackBaseGames: z.boolean().optional(),
  trackBundles: z.boolean().optional(),
  trackDlc: z.boolean().optional(),
  trackExpansions: z.boolean().optional(),
  trackSeasonPasses: z.boolean().optional(),
  trackAddons: z.boolean().optional(),
  trackContentPacks: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bu ayarları yalnızca sistem yöneticisi (OWNER) görüntüleyebilir." }, { status: 403 });
  }

  try {
    const settings = await getSystemSettings();

    // Collect system stats
    const [
      totalGames,
      totalHistories,
      totalDeals,
      totalRelations,
      totalUsers,
      totalAlerts,
      totalPendingNotifications,
      lastSyncRun,
    ] = await Promise.all([
      prisma.game.count(),
      prisma.priceHistory.count(),
      prisma.dealAnalysis.count(),
      prisma.gameRelation.count(),
      prisma.user.count(),
      prisma.priceAlert.count({ where: { isEnabled: true } }),
      prisma.notificationEvent.count({ where: { status: "PENDING" } }),
      prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    ]);

    // Breakdown of game relations
    const relationsByType = await prisma.gameRelation.groupBy({
      by: ["relationType"],
      _count: { relationType: true },
    });

    // Breakdown of product types
    const gamesByType = await prisma.game.groupBy({
      by: ["productType"],
      _count: { productType: true },
    });

    return NextResponse.json({
      settings,
      stats: {
        totalGames,
        totalHistories,
        totalDeals,
        totalRelations,
        totalUsers,
        activeAlerts: totalAlerts,
        pendingNotifications: totalPendingNotifications,
        lastSyncRun,
        relationsByType: relationsByType.map((r) => ({ type: r.relationType, count: r._count.relationType })),
        gamesByType: gamesByType.map((g) => ({ type: g.productType, count: g._count.productType })),
      },
    });
  } catch (err: any) {
    console.error("[Settings GET Error]", err);
    return NextResponse.json({ error: "Ayarlar yüklenemedi." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bu ayarları yalnızca sistem yöneticisi (OWNER) değiştirebilir." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz ayar verisi." },
        { status: 400 }
      );
    }

    const updated = await updateSystemSettings(parsed.data);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error("[Settings PUT Error]", err);
    return NextResponse.json({ error: "Ayarlar güncellenemedi." }, { status: 500 });
  }
}
