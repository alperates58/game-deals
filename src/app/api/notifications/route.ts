import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireActiveUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveUser();
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.userNotification.count({
        where: { userId: session.userId },
      }),
      prisma.userNotification.count({
        where: { userId: session.userId, readAt: null },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bildirimler alınamadı." }, { status: 500 });
  }
}
