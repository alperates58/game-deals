import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "30")));
    const action = searchParams.get("action");
    const actorEmail = searchParams.get("actorEmail");

    const where: any = {};
    if (action) where.action = action;
    if (actorEmail) where.actorEmail = { contains: actorEmail, mode: "insensitive" };

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Audit log get error:", error);
    return NextResponse.json({ error: "Denetim günlükleri alınırken hata oluştu" }, { status: 500 });
  }
}
