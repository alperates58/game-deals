import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotificationDeliveryStatus } from "@prisma/client";
import { logAdminAudit } from "@/lib/audit/audit-logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireOwner();
    const { id } = await params;

    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Teslimat kaydı bulunamadı" }, { status: 404 });
    }

    const updated = await prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: NotificationDeliveryStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lastErrorSummary: null,
      },
    });

    await logAdminAudit({
      actorId: owner.userId,
      actorEmail: owner.email,
      action: "RETRY_NOTIFICATION_DELIVERY",
      entityType: "NotificationDelivery",
      entityId: id,
      details: {
        channel: delivery.channel,
        previousStatus: delivery.status,
        previousAttempts: delivery.attemptCount,
      },
    });

    return NextResponse.json({ success: true, delivery: updated });
  } catch (error: any) {
    if (error.message?.includes("YETKİSİZ")) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }
    console.error("Retry delivery error:", error);
    return NextResponse.json({ error: "Yeniden deneme sırasında hata oluştu" }, { status: 500 });
  }
}
