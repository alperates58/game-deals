import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";
import { Role, AccountStatus, MembershipTier } from "@prisma/client";
import { recordAdminAuditLog } from "@/lib/audit/audit-logger";

const UpdateUserSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  accountStatus: z.nativeEnum(AccountStatus).optional(),
  membershipTier: z.nativeEnum(MembershipTier).optional(),
  reason: z.string().max(200).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireOwner();
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
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
        updatedAt: true,
        lastLoginAt: true,
        passwordHash: true,
        accounts: {
          select: { id: true, provider: true, createdAt: true },
        },
        telegramConnection: {
          select: {
            isActive: true,
            telegramUsername: true,
            displayName: true,
            linkedAt: true,
          },
        },
        _count: {
          select: {
            userGames: true,
            priceAlerts: true,
            userNotifications: true,
            notificationDeliveries: true,
          },
        },
        priceAlerts: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            game: { select: { id: true, title: true, slug: true, currentPrice: true } },
          },
        },
        userGames: {
          take: 10,
          where: { OR: [{ owned: true }, { wishlist: true }, { favorite: true }] },
          include: {
            game: { select: { id: true, title: true, slug: true, currentPrice: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        accountStatus: user.accountStatus,
        membershipTier: user.membershipTier,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        hasPassword: Boolean(user.passwordHash),
        accounts: user.accounts,
        telegramConnection: user.telegramConnection,
        stats: {
          gamesCount: user._count.userGames,
          alertsCount: user._count.priceAlerts,
          notificationsCount: user._count.userNotifications,
          deliveriesCount: user._count.notificationDeliveries,
        },
        recentAlerts: user.priceAlerts,
        recentGames: user.userGames,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    if (err.message === "FORBIDDEN_NOT_OWNER") {
      return NextResponse.json({ error: "Bu işlem için OWNER yetkisi gereklidir." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kullanıcı detayları yüklenemedi." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireOwner();
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz veriler." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const { role, accountStatus, membershipTier, reason } = parsed.data;

    // OWNER SAFETY RULE 1: Self-demotion is strictly forbidden
    if (actor.userId === targetUser.id && role && role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Sistem güvenliği gereği kendi hesabınızın OWNER rolünü kaldıramazsınız." },
        { status: 400 }
      );
    }

    // OWNER SAFETY RULE 2: Self-suspension is strictly forbidden
    if (actor.userId === targetUser.id && accountStatus && accountStatus === AccountStatus.SUSPENDED) {
      return NextResponse.json(
        { error: "Kendi hesabınızı askıya alamazsınız." },
        { status: 400 }
      );
    }

    // Check total active owners if target is an OWNER being demoted or suspended
    if (
      targetUser.role === Role.OWNER &&
      ((role && role !== Role.OWNER) || (accountStatus && accountStatus === AccountStatus.SUSPENDED))
    ) {
      const activeOwnerCount = await prisma.user.count({
        where: { role: Role.OWNER, accountStatus: AccountStatus.ACTIVE },
      });

      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          {
            error:
              "Sistemde aktif en az bir OWNER bulunmalıdır. Son sistem yöneticisinin rolü düşürülemez veya hesabı askıya alınamaz.",
          },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (accountStatus !== undefined) updateData.accountStatus = accountStatus;
    if (membershipTier !== undefined) updateData.membershipTier = membershipTier;

    const beforeState = {
      role: targetUser.role,
      accountStatus: targetUser.accountStatus,
      membershipTier: targetUser.membershipTier,
    };

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Record Audit Log
    let action = "USER_UPDATE";
    if (role && role !== targetUser.role) action = "ROLE_CHANGE";
    else if (accountStatus === AccountStatus.SUSPENDED) action = "SUSPEND_USER";
    else if (accountStatus === AccountStatus.ACTIVE && targetUser.accountStatus === AccountStatus.SUSPENDED)
      action = "REACTIVATE_USER";
    else if (membershipTier && membershipTier !== targetUser.membershipTier) action = "MEMBERSHIP_TIER_UPDATE";

    await recordAdminAuditLog({
      actorUserId: actor.userId,
      action,
      entityType: "User",
      entityId: targetUser.id,
      targetUserId: targetUser.id,
      before: beforeState,
      after: {
        role: updatedUser.role,
        accountStatus: updatedUser.accountStatus,
        membershipTier: updatedUser.membershipTier,
      },
      reason: reason || "Yönetici işlemi",
    });

    return NextResponse.json({
      success: true,
      message: "Kullanıcı başarıyla güncellendi.",
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
        accountStatus: updatedUser.accountStatus,
        membershipTier: updatedUser.membershipTier,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    if (err.message === "FORBIDDEN_NOT_OWNER") {
      return NextResponse.json({ error: "Bu işlem için OWNER yetkisi gereklidir." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kullanıcı güncellenemedi." }, { status: 500 });
  }
}
