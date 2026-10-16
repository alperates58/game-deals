import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { getTelegramWebhookInfo } from "@/lib/notifications/telegram-webhook";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const info = await getTelegramWebhookInfo();

    return NextResponse.json(info);
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
    console.error("[Telegram Admin API] GET error:", error?.message || error);
    return NextResponse.json(
      { error: "Telegram durumu sorgulanırken hata oluştu" },
      { status: 500 }
    );
  }
}
