import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AlertsView, AlertItem, NotificationItem } from "@/components/alerts/alerts-view";
import { Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Fiyat Alarmları | Xbox Gerçek Fırsat Takip Sistemi",
  description: "Kurulu fiyat alarmlarınız ve bildirim olay geçmişiniz.",
};

export default async function AlertsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/alarmlar");
  }

  const [alerts, events] = await Promise.all([
    prisma.priceAlert.findMany({
      where: { userId: user.userId },
      include: {
        game: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            currentPrice: true,
            listPrice: true,
            discountPercent: true,
            historicalLow: true,
            dealAnalysis: {
              select: {
                dealScore: true,
                verdict: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notificationEvent.findMany({
      where: { userId: user.userId },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const formattedAlerts: AlertItem[] = alerts.map((a) => ({
    id: a.id,
    type: a.type,
    targetPrice: a.targetPrice ? Number(a.targetPrice) : null,
    targetDiscount: a.targetDiscount,
    targetDealScore: a.targetDealScore,
    isEnabled: a.isEnabled,
    triggerCount: 0,
    lastTriggeredAt: a.lastTriggeredAt ? a.lastTriggeredAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    game: {
      id: a.game.id,
      title: a.game.title,
      slug: a.game.slug,
      imageUrl: a.game.imageUrl,
      currentPrice: Number(a.game.currentPrice),
      listPrice: Number(a.game.listPrice),
      discountPercent: a.game.discountPercent,
      historicalLow: a.game.historicalLow ? Number(a.game.historicalLow) : null,
      dealAnalysis: a.game.dealAnalysis,
    },
  }));

  const formattedEvents: NotificationItem[] = events.map((e) => {
    const payload = e.payload as any;
    return {
      id: e.id,
      eventType: e.type,
      title: payload?.title || e.type,
      message: payload?.message || "Fiyat alarmı veya sistem bildirimi tetiklendi.",
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
          <Bell className="h-4 w-4" />
          <span>Fiyat Takip Bildirimleri</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Fiyat Alarmları</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Xbox mağazasında belirlediğiniz fiyat ve indirim kriterlerine göre çalışan alarmlarınız.
        </p>
      </div>

      <AlertsView initialAlerts={formattedAlerts} recentEvents={formattedEvents} />
    </div>
  );
}
