import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";
import { Role, AccountStatus, MembershipTier } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit")) || 25));
    const skip = (page - 1) * limit;

    const query = searchParams.get("q")?.trim() || "";
    const roleFilter = searchParams.get("role") as Role | null;
    const statusFilter = searchParams.get("status") as AccountStatus | null;
    const authMethod = searchParams.get("authMethod"); // "GOOGLE" | "PASSWORD" | "ALL"

    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    if (roleFilter && Object.values(Role).includes(roleFilter)) {
      where.role = roleFilter;
    }

    if (statusFilter && Object.values(AccountStatus).includes(statusFilter)) {
      where.accountStatus = statusFilter;
    }

    if (authMethod === "GOOGLE") {
      where.accounts = { some: { provider: "GOOGLE" } };
    } else if (authMethod === "PASSWORD") {
      where.passwordHash = { not: null };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          accountStatus: true,
          membershipTier: true,
          emailVerifiedAt: true,
          createdAt: true,
          lastLoginAt: true,
          passwordHash: true,
          accounts: { select: { provider: true } },
          _count: {
            select: {
              userGames: true,
              priceAlerts: true,
              userNotifications: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      role: u.role,
      accountStatus: u.accountStatus,
      membershipTier: u.membershipTier,
      emailVerifiedAt: u.emailVerifiedAt,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      hasPassword: Boolean(u.passwordHash),
      isGoogle: u.accounts.some((a) => a.provider === "GOOGLE"),
      gamesCount: u._count.userGames,
      alertsCount: u._count.priceAlerts,
      notificationsCount: u._count.userNotifications,
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    if (err.message === "FORBIDDEN_NOT_OWNER") {
      return NextResponse.json({ error: "Bu işlem için OWNER yetkisi gereklidir." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kullanıcılar yüklenemedi." }, { status: 500 });
  }
}
