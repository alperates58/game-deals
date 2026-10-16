import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { recordAdminAuditLog } from "@/lib/audit/audit-logger";
import {
  getTelegramWebhookInfo,
  ensureTelegramWebhook,
  deleteTelegramWebhook,
} from "@/lib/notifications/telegram-webhook";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireOwner();
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "remove" ? "remove" : "sync";
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : undefined;
    const ipAddress = getClientIp(req);

    const beforeInfo = await getTelegramWebhookInfo();

    if (action === "remove") {
      const result = await deleteTelegramWebhook();

      await recordAdminAuditLog({
        actorUserId: user.userId,
        action: "TELEGRAM_WEBHOOK_REMOVE",
        entityType: "Integration",
        entityId: "telegram",
        before: {
          webhookStatus: beforeInfo.webhookStatus,
          webhookUrl: beforeInfo.webhookUrl,
          pendingUpdateCount: beforeInfo.pendingUpdateCount,
        },
        after: {
          webhookStatus: result.webhookInfo.webhookStatus,
          webhookUrl: result.webhookInfo.webhookUrl,
          pendingUpdateCount: result.webhookInfo.pendingUpdateCount,
        },
        reason: reason || "Admin panelinden Telegram webhook kaldırıldı",
        ipAddress,
      });

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    const result = await ensureTelegramWebhook();

    await recordAdminAuditLog({
      actorUserId: user.userId,
      action: "TELEGRAM_WEBHOOK_SYNC",
      entityType: "Integration",
      entityId: "telegram",
      before: {
        webhookStatus: beforeInfo.webhookStatus,
        webhookUrl: beforeInfo.webhookUrl,
        pendingUpdateCount: beforeInfo.pendingUpdateCount,
      },
      after: {
        webhookStatus: result.webhookInfo.webhookStatus,
        webhookUrl: result.webhookInfo.webhookUrl,
        pendingUpdateCount: result.webhookInfo.pendingUpdateCount,
      },
      reason: reason || "Admin panelinden Telegram webhook senkronize edildi",
      ipAddress,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmalısınız" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN_NOT_OWNER" || error.message === "ACCOUNT_SUSPENDED") {
      return NextResponse.json(
        { error: "Yetkisiz erişim. Bu işlem sadece OWNER yetkisindedir." },
        { status: 403 }
      );
    }
    console.error("[Telegram Admin API] POST webhook error:", error?.message || error);
    return NextResponse.json(
      { error: "Telegram webhook işlemi gerçekleştirilirken hata oluştu" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireOwner();
    const ipAddress = getClientIp(req);
    const beforeInfo = await getTelegramWebhookInfo();
    const result = await deleteTelegramWebhook();

    await recordAdminAuditLog({
      actorUserId: user.userId,
      action: "TELEGRAM_WEBHOOK_REMOVE",
      entityType: "Integration",
      entityId: "telegram",
      before: {
        webhookStatus: beforeInfo.webhookStatus,
        webhookUrl: beforeInfo.webhookUrl,
        pendingUpdateCount: beforeInfo.pendingUpdateCount,
      },
      after: {
        webhookStatus: result.webhookInfo.webhookStatus,
        webhookUrl: result.webhookInfo.webhookUrl,
        pendingUpdateCount: result.webhookInfo.pendingUpdateCount,
      },
      reason: "Admin panelinden Telegram webhook silindi (DELETE)",
      ipAddress,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmalısınız" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN_NOT_OWNER" || error.message === "ACCOUNT_SUSPENDED") {
      return NextResponse.json(
        { error: "Yetkisiz erişim. Bu işlem sadece OWNER yetkisindedir." },
        { status: 403 }
      );
    }
    console.error("[Telegram Admin API] DELETE webhook error:", error?.message || error);
    return NextResponse.json(
      { error: "Telegram webhook silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
