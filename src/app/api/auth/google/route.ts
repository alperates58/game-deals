import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import {
  getGoogleOAuthConfig,
  getGoogleOidcClientConfig,
  sanitizeReturnTo,
  createOAuthStateToken,
  GOOGLE_OAUTH_COOKIE_NAME,
  OAUTH_COOKIE_DURATION_SECONDS,
} from "@/lib/auth/google";

export async function GET(req: NextRequest) {
  try {
    const { isConfigured, redirectUri } = getGoogleOAuthConfig();

    if (!isConfigured) {
      return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
    }

    const searchParams = req.nextUrl.searchParams;
    const rawReturnTo = searchParams.get("returnTo");
    const returnTo = sanitizeReturnTo(rawReturnTo);

    const oidcConfig = getGoogleOidcClientConfig();

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authUrl = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: redirectUri,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
      prompt: "select_account",
    });

    const stateToken = await createOAuthStateToken({
      state,
      codeVerifier,
      nonce,
      returnTo,
    });

    const response = NextResponse.redirect(authUrl.href);
    response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, stateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_COOKIE_DURATION_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error("[Google OAuth Init Error]", error?.message || "Unknown error");
    return NextResponse.redirect(new URL("/login?error=google_failed", req.url));
  }
}
