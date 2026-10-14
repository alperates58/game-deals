import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1;`;

    const [totalGames, activeDeals, lastSync] = await Promise.all([
      prisma.game.count({ where: { isActive: true } }),
      prisma.game.count({ where: { isActive: true, discountPercent: { gt: 0 } } }),
      prisma.syncRun.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, productsChecked: true, pricesChanged: true },
      }),
    ]);

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      service: "game.alperates.com.tr",
      timestamp: new Date().toISOString(),
      latencyMs,
      database: "connected",
      stats: {
        totalGames,
        activeDeals,
        lastSyncAt: lastSync?.finishedAt || null,
        lastSyncChecked: lastSync?.productsChecked || 0,
        lastSyncChanges: lastSync?.pricesChanged || 0,
      },
    });
  } catch (error: any) {
    console.error("[HealthAPI] Error:", error.message);
    return NextResponse.json(
      {
        status: "unhealthy",
        service: "game.alperates.com.tr",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Veritabanı bağlantı hatası",
      },
      { status: 503 }
    );
  }
}
