import { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { UsersTable } from "@/components/admin/users/users-table";

export const metadata: Metadata = {
  title: "Kullanıcı Yönetimi | Admin Control Center",
  description: "Sistem kullanıcıları, rolleri, askıya alma ve üyelik kontrolleri.",
};

export default async function AdminUsersPage() {
  const limit = 25;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
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
      take: limit,
    }),
    prisma.user.count(),
  ]);

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    accountStatus: u.accountStatus,
    membershipTier: u.membershipTier,
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    hasPassword: Boolean(u.passwordHash),
    isGoogle: u.accounts.some((a) => a.provider === "GOOGLE"),
    gamesCount: u._count.userGames,
    alertsCount: u._count.priceAlerts,
    notificationsCount: u._count.userNotifications,
  }));

  return (
    <UsersTable
      initialUsers={formattedUsers}
      initialPagination={{
        page: 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }}
    />
  );
}
