import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { UserSettingsCenter } from "@/components/settings/user-settings-center";
import { isEmailConfigured } from "@/lib/notifications/email-provider";
import { isTelegramConfigured } from "@/lib/notifications/telegram-provider";
import { NotificationChannel, NotificationEventType, PriceAlertType } from "@prisma/client";
import { Sliders } from "lucide-react";

export const metadata: Metadata = {
  title: "Hesap ve Bildirim Ayarları | Game Deals",
  description: "Kişisel hesap, bildirim tercihleri ve kanal ayarları.",
};

const ALL_EVENT_TYPES = Object.values(NotificationEventType);
const ALL_CHANNELS = Object.values(NotificationChannel);

export default async function SettingsPage() {
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    redirect("/login?redirect=/ayarlar");
  }

  const [dbUser, preferences] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.userId },
      include: {
        accounts: true,
        telegramConnection: true,
        notificationSettings: true,
      },
    }),
    prisma.userNotificationPreference.findMany({
      where: { userId: sessionUser.userId },
    }),
  ]);

  if (!dbUser) {
    redirect("/login");
  }

  // Build preferences matrix
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const evt of ALL_EVENT_TYPES) {
    matrix[evt] = {};
    for (const ch of ALL_CHANNELS) {
      const found = preferences.find((p) => p.eventType === evt && p.channel === ch);
      matrix[evt][ch] = found ? found.enabled : true;
    }
  }

  const isGoogleLinked = dbUser.accounts.some((a) => a.provider === "GOOGLE");
  const hasPassword = Boolean(dbUser.passwordHash);

  const initialUser = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role,
    membershipTier: dbUser.membershipTier,
    accountStatus: dbUser.accountStatus,
    emailVerifiedAt: dbUser.emailVerifiedAt ? dbUser.emailVerifiedAt.toISOString() : null,
    createdAt: dbUser.createdAt.toISOString(),
    isGoogleLinked,
    hasPassword,
  };

  const initialTelegram = dbUser.telegramConnection
    ? {
        isActive: dbUser.telegramConnection.isActive,
        telegramUsername: dbUser.telegramConnection.telegramUsername,
        displayName: dbUser.telegramConnection.displayName,
        linkedAt: dbUser.telegramConnection.linkedAt.toISOString(),
      }
    : null;

  const initialNotificationSettings = {
    quietHoursEnabled: dbUser.notificationSettings?.quietHoursEnabled ?? false,
    quietHoursStart: dbUser.notificationSettings?.quietHoursStart ?? "23:00",
    quietHoursEnd: dbUser.notificationSettings?.quietHoursEnd ?? "08:00",
    timezone: dbUser.notificationSettings?.timezone ?? "Europe/Istanbul",
    defaultAlertType: dbUser.notificationSettings?.defaultAlertType ?? PriceAlertType.ANY_DISCOUNT,
    defaultLanguage: dbUser.notificationSettings?.defaultLanguage ?? "tr-TR",
    defaultCurrency: dbUser.notificationSettings?.defaultCurrency ?? "TRY",
  };

  return (
    <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Sliders className="h-4 w-4" />
            <span>Kişisel Ayarlar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Ayarlar ve Tercihler</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Profilinizi düzenleyin, giriş güvenliğinizi kontrol edin ve çok kanallı bildirimlerinizi kişiselleştirin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 border border-zinc-800">
            {dbUser.email}
          </span>
        </div>
      </div>

      <UserSettingsCenter
        initialUser={initialUser}
        initialTelegram={initialTelegram}
        initialNotificationSettings={initialNotificationSettings}
        initialMatrix={matrix}
        isEmailConfigured={isEmailConfigured()}
        isTelegramConfigured={isTelegramConfigured()}
      />
    </div>
  );
}
