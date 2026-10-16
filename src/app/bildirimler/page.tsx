import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import { NotificationInboxClient } from "@/components/notifications/notification-inbox-client";

export const metadata: Metadata = {
  title: "Bildirimlerim | Game Deals",
  description: "Fiyat düşüşleri, dip fiyatlar ve kişisel fırsat bildirimleriniz.",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/bildirimler");
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.userNotification.count({
      where: { userId: user.userId },
    }),
    prisma.userNotification.count({
      where: { userId: user.userId, readAt: null },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Bell className="h-4 w-4" />
            <span>Kişisel Bildirim Merkezi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Bildirimler</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Fiyat düşüşleri, alarmlarınız ve takip listenizdeki güncellemeler.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/ayarlar"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Bildirim Tercihleri
          </Link>
        </div>
      </div>

      <NotificationInboxClient
        initialNotifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          linkUrl: n.linkUrl,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        }))}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
