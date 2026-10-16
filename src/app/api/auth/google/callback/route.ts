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
import { setSessionCookieOnResponse, shouldUseSecureCookies } from "@/lib/auth/session";

function clearOAuthCookie(response: NextResponse, req?: NextRequest) {
  response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(req: NextRequest) {
  const { redirectUri, appUrl } = getGoogleOAuthConfig(req);

  try {
    const searchParams = req.nextUrl.searchParams;
    const oauthError = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // 1. Handle error returned by Google authorization server
    if (oauthError) {
      const sanitizedParam =
        oauthError === "access_denied" ? "google_access_denied" : "google_failed";
      const response = NextResponse.redirect(new URL(`/login?error=${sanitizedParam}`, appUrl));
      clearOAuthCookie(response, req);
      return response;
    }

    // 2. Retrieve and verify state cookie
    const stateCookie = req.cookies.get(GOOGLE_OAUTH_COOKIE_NAME)?.value;
    if (!stateCookie) {
      const response = NextResponse.redirect(new URL("/login?error=invalid_state", appUrl));
      clearOAuthCookie(response, req);
      return response;
    }

    const stateData = await verifyOAuthStateToken(stateCookie);
    if (!stateData || !state || stateData.state !== state || !code) {
      const response = NextResponse.redirect(new URL("/login?error=invalid_state", appUrl));
      clearOAuthCookie(response, req);
      return response;
    }

    // 3. Exchange code for tokens and validate ID token using OpenID Client
    // Crucial: Use canonical public redirectUri with incoming query parameters so
    // openid-client sends the exact redirect_uri that was used during authorization,
    // rather than internal container hostname (localhost:3000).
    const oidcConfig = getGoogleOidcClientConfig(req);
    const currentUrl = new URL(`${redirectUri}?${searchParams.toString()}`);

    const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
      pkceCodeVerifier: stateData.codeVerifier,
      expectedState: stateData.state,
      expectedNonce: stateData.nonce,
    });

    const claims = tokens.claims();
    if (!claims || !claims.sub || !claims.email) {
      const response = NextResponse.redirect(new URL("/login?error=google_failed", appUrl));
      clearOAuthCookie(response, req);
      return response;
    }

    // 4. Enforce email_verified
    if (!claims.email_verified) {
      const response = NextResponse.redirect(new URL("/login?error=email_not_verified", appUrl));
      clearOAuthCookie(response, req);
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
      let errCode = "google_failed";
      if (err?.message === "REGISTRATION_DISABLED") {
        errCode = "registration_disabled";
      } else if (err?.message === "ACCOUNT_SUSPENDED") {
        errCode = "account_suspended";
      }
      const response = NextResponse.redirect(new URL(`/login?error=${errCode}`, appUrl));
      clearOAuthCookie(response, req);
      return response;
    }


    // 6. Set session cookie and redirect to sanitized returnTo using public appUrl
    const targetPath = sanitizeReturnTo(stateData.returnTo);
    const redirectUrl = new URL(targetPath, appUrl);
    const response = NextResponse.redirect(redirectUrl);

    // Clear temporary OAuth cookie
    clearOAuthCookie(response, req);

    // Issue standard game_deals_session cookie
    await setSessionCookieOnResponse(
      response,
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      req
    );

    return response;
  } catch (error: any) {
    console.error("[Google OAuth Callback Error]", error?.message || "Unknown error");
    const response = NextResponse.redirect(new URL("/login?error=google_failed", appUrl));
    clearOAuthCookie(response, req);
    return response;
  }
}
