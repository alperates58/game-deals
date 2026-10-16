import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getGoogleOAuthConfig } from "@/lib/auth/google";

export async function POST(req: NextRequest) {
  await clearSessionCookie();

  const acceptHeader = req.headers.get("accept") || "";
  if (acceptHeader.includes("application/json") && !acceptHeader.includes("text/html")) {
    return NextResponse.json({ success: true, redirect: "/login" });
  }

  const { appUrl } = getGoogleOAuthConfig(req);
  const response = NextResponse.redirect(new URL("/login", appUrl), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(req: NextRequest) {
  await clearSessionCookie();
  const { appUrl } = getGoogleOAuthConfig(req);
  const response = NextResponse.redirect(new URL("/login", appUrl), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
