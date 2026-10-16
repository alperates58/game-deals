import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  await clearSessionCookie();

  const acceptHeader = req.headers.get("accept") || "";
  if (acceptHeader.includes("application/json") && !acceptHeader.includes("text/html")) {
    return NextResponse.json({ success: true, redirect: "/login" });
  }

  const response = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
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
  const response = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
