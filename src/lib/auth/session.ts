import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

import { assertServerEnv } from "../config/env-validation";

const SESSION_COOKIE_NAME = "game_deals_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

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
 * Sets session cookie on HTTP response.
 */
export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Clears session cookie on logout.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
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
 * Enforces OWNER role authorization; throws 403 error if user is not OWNER.
 */
export async function requireOwner(): Promise<SessionPayload> {
  const user = await requireAuth();
  if (user.role !== Role.OWNER) {
    throw new Error("FORBIDDEN_NOT_OWNER");
  }
  return user;
}
