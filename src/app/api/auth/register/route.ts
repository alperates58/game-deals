import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { isRegistrationAllowed } from "@/lib/settings/system-settings";
import { Role } from "@prisma/client";

const RegisterSchema = z
  .object({
    name: z.string().min(2, "İsim en az 2 karakter olmalıdır.").max(50),
    email: z.string().email("Geçerli bir e-posta adresi giriniz.").toLowerCase().trim(),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Şifreler birbiriyle eşleşmiyor.",
    path: ["passwordConfirmation"],
  });

export async function POST(req: Request) {
  try {
    const allowed = await isRegistrationAllowed();
    if (!allowed) {
      return NextResponse.json(
        { error: "Kullanıcı kaydı şu anda sistem yöneticisi tarafından durdurulmuştur." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz form verisi." },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanımda." },
        { status: 400 }
      );
    }

    // First user is automatically assigned the OWNER role
    const userCount = await prisma.user.count();
    const role: Role = userCount === 0 ? Role.OWNER : Role.USER;

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error("[Register Error]", error);
    return NextResponse.json(
      { error: "Kayıt işlemi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
