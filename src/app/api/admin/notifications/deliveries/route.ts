import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "30")));
    const status = searchParams.get("status") as NotificationDeliveryStatus | null;
    const channel = searchParams.get("channel") as NotificationChannel | null;
    const userId = searchParams.get("userId");

    const where: any = {};
    if (status && Object.values(NotificationDeliveryStatus).includes(status)) {
      where.status = status;
    }
    if (channel && Object.values(NotificationChannel).includes(channel)) {
      where.channel = channel;
    }
    if (userId) {
      where.userId = userId;
    }

    const [deliveries, total, statusCountsRaw] = await Promise.all([
      prisma.notificationDelivery.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          event: {
            select: {
              id: true,
              type: true,
              gameId: true,
              dedupeKey: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.notificationDelivery.count({ where }),
      prisma.notificationDelivery.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    statusCountsRaw.forEach((sc) => {
      statusCounts[sc.status] = sc._count.id;
    });

    return NextResponse.json({
      deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
    });
  } catch (error: any) {
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Deliveries fetch error:", error);
    return NextResponse.json({ error: "Kuyruk listelenirken hata oluştu" }, { status: 500 });
  }
}
