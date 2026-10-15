import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const iconPath = path.join(process.cwd(), "public", "icon.svg");
    if (fs.existsSync(iconPath)) {
      const svg = fs.readFileSync(iconPath, "utf-8");
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch (err) {
    console.error("Failed to serve favicon:", err);
  }

  return NextResponse.redirect(new URL("/icon.svg", req.url));
}
