import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAndConsumeEmailToken } from "@/lib/notifications/token-service";

const VerifySchema = z.object({
  token: z.string().min(1, "Token zorunludur."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz token formatı." }, { status: 400 });
    }

    const result = await verifyAndConsumeEmailToken(parsed.data.token);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "E-posta adresiniz başarıyla doğrulandı.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Doğrulama işlemi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
