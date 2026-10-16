import { SignJWT, jwtVerify } from "jose";
import * as client from "openid-client";
import { prisma } from "../db/prisma";
import { AuthProvider, Role, User } from "@prisma/client";
import { getSessionSecretKey } from "./session";

export const GOOGLE_OAUTH_COOKIE_NAME = "game_deals_oauth_state";
export const OAUTH_COOKIE_DURATION_SECONDS = 600; // 10 minutes

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  redirectUri: string;
  isConfigured: boolean;
}

export interface OAuthStateData {
  state: string;
  codeVerifier: string;
  nonce: string;
  returnTo: string;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
}

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

/**
 * Resolves the public canonical base URL of the application.
 * Respects APP_URL env variable and reverse proxy headers (x-forwarded-host, x-forwarded-proto),
 * ensuring internal Docker/container hostnames (e.g. localhost:3000 or web:3000) are never leaked to user browsers.
 */
export function getPublicBaseUrl(req?: Request | { headers: Headers }): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== "") {
    return process.env.APP_URL.trim().replace(/\/$/, "");
  }

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }

    const host = req.headers.get("host");
    if (
      host &&
      !host.includes("localhost") &&
      !host.includes("127.0.0.1") &&
      !host.startsWith("web:") &&
      !host.startsWith("0.0.0.0")
    ) {
      const proto = forwardedProto || "https";
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }

  return "http://localhost:3000";
}

/**
 * Returns Google OAuth configuration status. Never logs or leaks secrets.
 */
export function getGoogleOAuthConfig(req?: Request | { headers: Headers }): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const appUrl = getPublicBaseUrl(req);
  const isConfigured = Boolean(clientId && clientSecret);
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  return {
    clientId,
    clientSecret,
    appUrl,
    redirectUri,
    isConfigured,
  };
}

/**
 * Generates an absolute public URL using canonical appUrl for redirects.
 */
export function getPublicRedirectUrl(path: string, req?: Request | { headers: Headers }): URL {
  const { appUrl } = getGoogleOAuthConfig(req);
  return new URL(path, appUrl);
}

/**
 * Creates the OpenID Client configuration for Google.
 */
export function getGoogleOidcClientConfig(req?: Request | { headers: Headers }): client.Configuration {
  const { clientId, clientSecret, isConfigured } = getGoogleOAuthConfig(req);
  if (!isConfigured) {
    throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  }

  return new client.Configuration(
    {
      issuer: GOOGLE_ISSUER,
      authorization_endpoint: GOOGLE_AUTH_ENDPOINT,
      token_endpoint: GOOGLE_TOKEN_ENDPOINT,
      userinfo_endpoint: GOOGLE_USERINFO_ENDPOINT,
      jwks_uri: GOOGLE_JWKS_URI,
    },
    clientId,
    clientSecret
  );
}

/**
 * Sanitizes returnTo redirect destination to prevent open redirect vulnerabilities.
 * Only internal relative paths are permitted.
 */
export function sanitizeReturnTo(url: string | null | undefined): string {
  if (!url) return "/profil";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("://")
  ) {
    return trimmed;
  }
  return "/profil";
}

/**
 * Encrypts/signs temporary OAuth state into a JWT for cookie storage.
 */
export async function createOAuthStateToken(data: OAuthStateData): Promise<string> {
  const secretKey = getSessionSecretKey();
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_COOKIE_DURATION_SECONDS}s`)
    .sign(secretKey);
}

/**
 * Verifies and decodes temporary OAuth state token from cookie.
 */
export async function verifyOAuthStateToken(token: string): Promise<OAuthStateData | null> {
  if (!token) return null;
  try {
    const secretKey = getSessionSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.state || !payload.codeVerifier) {
      return null;
    }
    return {
      state: payload.state as string,
      codeVerifier: payload.codeVerifier as string,
      nonce: (payload.nonce as string) || "",
      returnTo: sanitizeReturnTo(payload.returnTo as string),
    };
  } catch {
    return null;
  }
}

/**
 * Resolves or links a Google user in database according to strict security rules:
 * 1. Checks email_verified MUST be true.
 * 2. Checks AuthAccount(provider=GOOGLE, providerAccountId=sub). If exists -> login.
 * 3. Checks existing User with matching email. If exists -> link AuthAccount, preserve role (OWNER preserved!), preserve passwordHash.
 * 4. If no user exists, checks registration policy (allowRegistration). If open -> create USER (NEVER OWNER). If closed -> reject.
 * 5. Uses transaction and advisory lock for concurrency safety.
 */
export async function resolveGoogleUser(
  identity: GoogleIdentity,
  db = prisma
): Promise<User> {
  if (!identity.emailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const normalizedEmail = identity.email.toLowerCase().trim();
  const sub = identity.sub.trim();

  if (!normalizedEmail || !sub) {
    throw new Error("INVALID_GOOGLE_IDENTITY");
  }

  return db.$transaction(async (tx) => {
    // Advisory lock per sub to prevent concurrent race condition linking
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`google_auth:${sub}`}))`;
    } catch {
      // Non-postgres fallback for unit tests
    }

    // Step A: Check if this Google account is already linked
    const existingAccount = await tx.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: sub,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      const user = existingAccount.user;
      if (user.accountStatus === "SUSPENDED") {
        throw new Error("ACCOUNT_SUSPENDED");
      }

      const updateData: { lastLoginAt: Date; avatarUrl?: string; emailVerifiedAt?: Date } = {
        lastLoginAt: new Date(),
      };
      if (!user.avatarUrl && identity.picture) {
        updateData.avatarUrl = identity.picture;
      }
      if (!user.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
      }
      return tx.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // Step B: Check if a local user exists with the exact normalized email
    const existingUserByEmail = await tx.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUserByEmail) {
      if (existingUserByEmail.accountStatus === "SUSPENDED") {
        throw new Error("ACCOUNT_SUSPENDED");
      }

      // Link Google AuthAccount to this existing user!
      // IMPORTANT: Preserve existing role (especially OWNER) and passwordHash!
      await tx.authAccount.create({
        data: {
          userId: existingUserByEmail.id,
          provider: AuthProvider.GOOGLE,
          providerAccountId: sub,
        },
      });

      const updateData: { lastLoginAt: Date; avatarUrl?: string; emailVerifiedAt?: Date } = {
        lastLoginAt: new Date(),
      };
      if (!existingUserByEmail.avatarUrl && identity.picture) {
        updateData.avatarUrl = identity.picture;
      }
      if (!existingUserByEmail.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
      }

      return tx.user.update({
        where: { id: existingUserByEmail.id },
        data: updateData,
      });
    }

    // Step C: No user exists with this email -> Registration policy check
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

    // Create new USER (NEVER OWNER, role = USER always)
    const newUser = await tx.user.create({
      data: {
        name: identity.name?.trim() || "Google Kullanıcısı",
        email: normalizedEmail,
        passwordHash: null,
        role: Role.USER, // Google signup: ALWAYS USER!
        accountStatus: "ACTIVE",
        membershipTier: "FREE",
        emailVerifiedAt: new Date(),
        avatarUrl: identity.picture || null,
        lastLoginAt: new Date(),
        accounts: {
          create: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: sub,
          },
        },
      },
    });

    return newUser;
  });
}
