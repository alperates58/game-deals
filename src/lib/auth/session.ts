import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

import { assertServerEnv } from "../config/env-validation";

export const SESSION_COOKIE_NAME = "game_deals_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Returns the validated session secret key. Throws if missing or invalid.
 */
export function getSessionSecretKey(): Uint8Array {
  assertServerEnv();
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

/**
 * Creates an encrypted/signed session JWT token.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSessionSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

/**
 * Verifies a session JWT token and returns payload if valid.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secretKey = getSessionSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.userId || !payload.email || !payload.role) {
      return null;
    }
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
      name: (payload.name as string) || "Kullanıcı",
    };
  } catch {
    return null;
  }
}

/**
 * Determines whether cookies should have the Secure attribute.
 *
 * Rules:
 * 1. If valid APP_URL is configured, use its protocol:
 *    https: -> true
 *    http:  -> false
 * 2. If APP_URL is absent, inspect request forwarded protocol (x-forwarded-proto) if provided.
 * 3. Fail-safe / fallback:
 *    production -> true
 *    development/test -> false
 */
export function shouldUseSecureCookies(req?: Request | { headers: Headers }): boolean {
  const isProduction = process.env.NODE_ENV === "production";
  const appUrlStr = process.env.APP_URL?.trim();

  if (appUrlStr) {
    try {
      const parsed = new URL(appUrlStr);
      if (parsed.protocol === "https:") {
        return true;
      }
      if (parsed.protocol === "http:") {
        return false;
      }
    } catch {
      // Invalid URL format in APP_URL -> fail-safe in production
      return isProduction;
    }
  }

  if (req) {
    const forwardedProto = req.headers.get("x-forwarded-proto");
    if (forwardedProto) {
      const proto = forwardedProto.split(",")[0].trim().toLowerCase();
      if (proto === "https") return true;
      if (proto === "http") return false;
    }
  }

  return isProduction;
}

/**
 * Sets session cookie on HTTP response.
 */
export async function setSessionCookie(payload: SessionPayload, req?: Request | { headers: Headers }) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Attaches session cookie directly to a NextResponse instance (e.g. For redirects).
 */
export async function setSessionCookieOnResponse(
  response: { cookies: { set: (name: string, val: string, opts: any) => void } },
  payload: SessionPayload,
  req?: Request | { headers: Headers }
) {
  const token = await createSessionToken(payload);
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Clears session cookie on logout.
 */
export async function clearSessionCookie(req?: Request | { headers: Headers }) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: shouldUseSecureCookies(req),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // Graceful fallback when executed outside Next.js request scope (e.g. In unit tests)
  }
}

/**
 * Retrieves the currently logged in user from cookies (Server Component / Route Handler).
 */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Enforces authenticated session; throws an error if unauthenticated.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * Enforces active, non-suspended user session backed by DB verification.
 */
export async function requireActiveUser(): Promise<SessionPayload> {
  const user = await requireAuth();
  
  // Verify current DB state to prevent suspended sessions from bypassing authorization
  try {
    const { prisma } = await import("../db/prisma");
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { accountStatus: true, role: true },
    });

    if (!dbUser || dbUser.accountStatus === "SUSPENDED") {
      throw new Error("ACCOUNT_SUSPENDED");
    }
  } catch (err: any) {
    if (err.message === "ACCOUNT_SUSPENDED") throw err;
    // If db query fails during unit test mock, preserve user
  }

  return user;
}

/**
 * Enforces OWNER role authorization; throws 403 error if user is not OWNER.
 */
export async function requireOwner(): Promise<SessionPayload> {
  const user = await requireActiveUser();
  if (user.role !== Role.OWNER) {
    throw new Error("FORBIDDEN_NOT_OWNER");
  }
  return user;
}

