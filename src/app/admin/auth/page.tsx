import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSystemSettings } from "@/lib/settings/system-settings";
import { getGoogleOAuthConfig } from "@/lib/auth/google";
import { AuthSettingsClient } from "@/components/admin/auth/auth-settings-client";
import { KeyRound } from "lucide-react";
import { AccountStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Kimlik Doğrulama & Giriş Ayarları | Admin",
  description: "OAuth sağlayıcıları, kayıt politikaları ve güvenlik yapılandırması.",
};

export default async function AdminAuthPage() {
  await requireOwner();

  const [settings, totalUsers, passwordUsers, googleUsers, verifiedUsers, suspendedUsers] =
    await Promise.all([
      getSystemSettings(),
      prisma.user.count(),
      prisma.user.count({ where: { passwordHash: { not: null } } }),
      prisma.authAccount.count({ where: { provider: "GOOGLE" } }),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.user.count({ where: { accountStatus: AccountStatus.SUSPENDED } }),
    ]);

  const googleRaw = getGoogleOAuthConfig();
  const clientId = googleRaw.clientId;
  const clientIdMasked = clientId
    ? `${clientId.slice(0, 8)}...${clientId.slice(-12)}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <KeyRound className="h-4 w-4" />
            <span>Yönetim</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Kimlik Doğrulama & Güvenlik</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Kullanıcı kayıt izinleri, Google OAuth 2.0 durumu ve kimlik doğrulama istatistikleri.
          </p>
        </div>
      </div>

      <AuthSettingsClient
        initialAllowRegistration={settings.allowRegistration}
        googleConfig={{
          isConfigured: googleRaw.isConfigured,
          clientIdMasked,
          redirectUri: googleRaw.redirectUri,
        }}
        stats={{
          totalUsers,
          passwordUsers,
          googleUsers,
          verifiedUsers,
          suspendedUsers,
        }}
      />
    </div>
  );
}
