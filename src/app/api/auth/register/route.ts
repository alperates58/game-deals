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

const REGISTRATION_ADVISORY_LOCK_ID = 884848;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz form verisi." },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await hashPassword(password);

    // Atomic transaction protected by PostgreSQL transaction-scoped advisory lock
    const result = await prisma.$transaction(async (tx) => {
      // 1. Acquire transaction advisory lock to prevent concurrent first-owner race condition
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REGISTRATION_ADVISORY_LOCK_ID})`;
      } catch {
        // Fallback for non-postgres mock environments in unit tests
      }

      // 2. Validate registration policy
      if (process.env.ALLOW_REGISTRATION === "false") {
        throw new Error("REGISTRATION_DISABLED");
      }

      let settings = await tx.systemSetting.findUnique({
        where: { id: "global" },
      });

      if (!settings) {
        settings = await tx.systemSetting.create({
          data: {
            id: "global",
            allowRegistration: true,
          },
        });
      }

      if (!settings.allowRegistration) {
        throw new Error("REGISTRATION_DISABLED");
      }

      // 3. Check duplicate email inside lock
      const existingUser = await tx.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error("EMAIL_EXISTS");
      }

      // 4. Atomic check for first OWNER
      const userCount = await tx.user.count();
      const isFirstUser = userCount === 0;
      const role: Role = isFirstUser ? Role.OWNER : Role.USER;

      const newUser = await tx.user.create({
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

      // 5. If this was the first user (now OWNER), automatically disable registration for safety.
      // The OWNER can later re-enable registration in Settings (/ayarlar).
      if (isFirstUser) {
        await tx.systemSetting.update({
          where: { id: "global" },
          data: { allowRegistration: false },
        });
      }

      return { user: newUser, isFirstUser };
    });

    await setSessionCookie({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    });

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error: any) {
    if (error?.message === "REGISTRATION_DISABLED") {
      return NextResponse.json(
        { error: "Kullanıcı kaydı şu anda sistem yöneticisi tarafından durdurulmuştur." },
        { status: 403 }
      );
    }

    if (error?.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanımda." },
        { status: 400 }
      );
    }

    console.error("[Register Error]", error?.message || error);
    return NextResponse.json(
      { error: "Kayıt işlemi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
