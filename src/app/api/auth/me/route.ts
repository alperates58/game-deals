import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      passwordHash: true,
      avatarUrl: true,
      accounts: {
        select: {
          provider: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: {
      ...user,
      avatarUrl: dbUser?.avatarUrl || null,
      hasPassword: Boolean(dbUser?.passwordHash),
      hasGoogle: Boolean(dbUser?.accounts.some((a) => a.provider === "GOOGLE")),
      providers: dbUser?.accounts.map((a) => a.provider) || [],
    },
  });
}
