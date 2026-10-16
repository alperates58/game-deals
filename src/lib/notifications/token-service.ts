import crypto from "crypto";
import { prisma } from "../db/prisma";

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function generateSecureRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Generates a short-lived (15 minutes), single-use token for Telegram account linking.
 * Returns the plaintext token to be embedded in t.me/<bot>?start=<token>.
 * Only the SHA-256 hash is saved to the database.
 */
export async function createTelegramLinkToken(
  userId: string,
  db = prisma
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSecureRandomToken(24);
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.telegramLinkToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates and consumes a Telegram linking token.
 * Single use: marks usedAt immediately.
 */
export async function verifyAndConsumeTelegramLinkToken(
  token: string,
  db = prisma
): Promise<string | null> {
  if (!token || typeof token !== "string") return null;

  const tokenHash = hashOpaqueToken(token);
  const now = new Date();

  return await db.$transaction(async (tx) => {
    const record = await tx.telegramLinkToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt !== null || record.expiresAt < now) {
      return null;
    }

    // Mark as consumed
    await tx.telegramLinkToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });

    return record.userId;
  });
}

/**
 * Generates a 30-minute, single-use token for local password user email verification.
 */
export async function createEmailVerificationToken(
  userId: string,
  db = prisma
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSecureRandomToken(32);
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await db.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates and consumes an email verification token, setting emailVerifiedAt on the User.
 */
export async function verifyAndConsumeEmailToken(
  token: string,
  db = prisma
): Promise<{ success: boolean; userId?: string; error?: string }> {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Geçersiz doğrulama bağlantısı." };
  }

  const tokenHash = hashOpaqueToken(token);
  const now = new Date();

  try {
    return await db.$transaction(async (tx) => {
      const record = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!record) {
        return { success: false, error: "Doğrulama bağlantısı bulunamadı." };
      }

      if (record.usedAt !== null) {
        return { success: false, error: "Bu doğrulama bağlantısı daha önce kullanılmış." };
      }

      if (record.expiresAt < now) {
        return { success: false, error: "Doğrulama bağlantısının süresi dolmuş. Lütfen yeni bir bağlantı talep ediniz." };
      }

      // Mark token used
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      });

      // Mark user email verified
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      });

      return { success: true, userId: record.userId };
    });
  } catch (err: any) {
    return { success: false, error: err?.message || "Doğrulama sırasında bir hata oluştu." };
  }
}
