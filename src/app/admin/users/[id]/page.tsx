import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { UserDetail } from "@/components/admin/users/user-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true },
  });

  return {
    title: user ? `${user.name} (${user.email}) | Kullanıcı Detayı | Admin` : "Kullanıcı Bulunamadı | Admin",
  };
}

export default async function AdminUserDetailPage({ params }: Props) {
  await requireOwner();
  const { id } = await params;

  const [dbUser, recentAlerts, recentGames] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
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
      },
    }),
    prisma.priceAlert.findMany({
      where: { userId: id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        game: { select: { id: true, title: true } },
      },
    }),
    prisma.userGame.findMany({
      where: { userId: id },
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        game: { select: { id: true, title: true } },
      },
    }),
  ]);

  if (!dbUser) {
    notFound();
  }

  const user = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role,
    accountStatus: dbUser.accountStatus,
    membershipTier: dbUser.membershipTier,
    emailVerifiedAt: dbUser.emailVerifiedAt ? dbUser.emailVerifiedAt.toISOString() : null,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    lastLoginAt: dbUser.lastLoginAt ? dbUser.lastLoginAt.toISOString() : null,
    hasPassword: Boolean(dbUser.passwordHash),
    accounts: dbUser.accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      createdAt: a.createdAt.toISOString(),
    })),
    telegramConnection: dbUser.telegramConnection
      ? {
          isActive: dbUser.telegramConnection.isActive,
          telegramUsername: dbUser.telegramConnection.telegramUsername,
          displayName: dbUser.telegramConnection.displayName,
          linkedAt: dbUser.telegramConnection.linkedAt.toISOString(),
        }
      : null,
    stats: {
      gamesCount: dbUser._count.userGames,
      alertsCount: dbUser._count.priceAlerts,
      notificationsCount: dbUser._count.userNotifications,
      deliveriesCount: dbUser._count.notificationDeliveries,
    },
    recentAlerts: recentAlerts.map((a) => ({
      id: a.id,
      type: a.type,
      targetPrice: a.targetPrice ? Number(a.targetPrice) : null,
      isActive: a.isEnabled,
      lastTriggeredAt: a.lastTriggeredAt ? a.lastTriggeredAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      game: a.game,
    })),
    recentGames: recentGames.map((g) => ({
      id: g.id,
      status: g.owned ? "OWNED" : g.wishlist ? "WISHLIST" : "FAVORITE",
      isFavorite: g.favorite,
      rating: null,
      game: g.game,
      updatedAt: g.updatedAt.toISOString(),
    })),
  };

  return <UserDetail user={user} />;
}
