import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import {
  getGoogleOAuthConfig,
  getGoogleOidcClientConfig,
  verifyOAuthStateToken,
  resolveGoogleUser,
  sanitizeReturnTo,
  GOOGLE_OAUTH_COOKIE_NAME,
} from "@/lib/auth/google";
import { setSessionCookieOnResponse } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const oauthError = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // 1. Handle error returned by Google authorization server
    if (oauthError) {
      const sanitizedParam =
        oauthError === "access_denied" ? "google_access_denied" : "google_failed";
      const response = NextResponse.redirect(new URL(`/login?error=${sanitizedParam}`, req.url));
      response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }

    // 2. Retrieve and verify state cookie
    const stateCookie = req.cookies.get(GOOGLE_OAUTH_COOKIE_NAME)?.value;
    if (!stateCookie) {
      const response = NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
      response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }

    const stateData = await verifyOAuthStateToken(stateCookie);
    if (!stateData || !state || stateData.state !== state || !code) {
      const response = NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
      response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }

    // 3. Exchange code for tokens and validate ID token using OpenID Client
    const oidcConfig = getGoogleOidcClientConfig();
    const currentUrl = new URL(req.url);

    const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
      pkceCodeVerifier: stateData.codeVerifier,
      expectedState: stateData.state,
      expectedNonce: stateData.nonce,
    });

    const claims = tokens.claims();
    if (!claims || !claims.sub || !claims.email) {
      const response = NextResponse.redirect(new URL("/login?error=google_failed", req.url));
      response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }

    // 4. Enforce email_verified
    if (!claims.email_verified) {
      const response = NextResponse.redirect(new URL("/login?error=email_not_verified", req.url));
      response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }

    const sub = claims.sub;
    const email = claims.email as string;
    const name = (claims.name as string) || (claims.given_name as string) || null;
    const picture = (claims.picture as string) || null;

    // 5. Atomic user resolution & account linking
    let user;
    try {
      user = await resolveGoogleUser({
        sub,
        email,
        emailVerified: true,
        name,
        picture,
      });
    } catch (err: any) {
      const errCode =
        err?.message === "REGISTRATION_DISABLED" ? "registration_disabled" : "google_failed";
      const response = NextResponse.redirect(new URL(`/login?error=${errCode}`, req.url));
      response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }

    // 6. Set session cookie and redirect to sanitized returnTo
    const targetPath = sanitizeReturnTo(stateData.returnTo);
    const redirectUrl = new URL(targetPath, req.url);
    const response = NextResponse.redirect(redirectUrl);

    // Clear temporary OAuth cookie
    response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });

    // Issue standard game_deals_session cookie
    await setSessionCookieOnResponse(response, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return response;
  } catch (error: any) {
    console.error("[Google OAuth Callback Error]", error?.message || "Unknown error");
    const response = NextResponse.redirect(new URL("/login?error=google_failed", req.url));
    response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }
}
