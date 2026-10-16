import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { MembershipTier } from "@prisma/client";
import { ShieldCheck, CheckCircle2, Users, Award } from "lucide-react";
import { getUserEntitlements } from "@/lib/membership/entitlements";

export const metadata: Metadata = {
  title: "Üyelik & Erişim Yönetimi | Admin",
  description: "Kullanıcı üyelik katmanları, limitler ve yetkilendirme modeli.",
};

export default async function AdminMembershipPage() {
  await requireOwner();

  const tierCountsRaw = await prisma.user.groupBy({
    by: ["membershipTier"],
    _count: { id: true },
  });

  const counts: Record<MembershipTier, number> = {
    FREE: 0,
    PRO: 0,
  };

  tierCountsRaw.forEach((t) => {
    counts[t.membershipTier] = t._count.id;
  });

  const totalUsers = Object.values(counts).reduce((a, b) => a + b, 0);

  const freeEntitlements = getUserEntitlements({ role: "USER" as any, membershipTier: MembershipTier.FREE });
  const proEntitlements = getUserEntitlements({ role: "USER" as any, membershipTier: MembershipTier.PRO });

  const tiers = [
    {
      tier: MembershipTier.FREE,
      name: "Free (Standart)",
      badgeColor: "bg-zinc-800 text-zinc-300 border-zinc-700",
      description: "Temel katalog takibi, standart bildirim kanalları ve sınırlı alarm kotası.",
      userCount: counts.FREE,
      maxAlerts: freeEntitlements.maxActiveAlerts,
      instant: freeEntitlements.instantNotifications,
      features: [
        "Temel web push & e-posta",
        `${freeEntitlements.maxActiveAlerts} aktif fiyat alarmı`,
        "Standart fiyat geçmişi",
        "Topluluk fırsat bildirimleri",
      ],
    },
    {
      tier: MembershipTier.PRO,
      name: "Pro Üyelik",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      description: "Genişletilmiş alarmlar, Telegram entegrasyonu ve tüm fiyat grafikleri.",
      userCount: counts.PRO,
      maxAlerts: proEntitlements.maxActiveAlerts,
      instant: proEntitlements.instantNotifications,
      features: [
        "Tüm e-posta & anlık Telegram botu",
        `${proEntitlements.maxActiveAlerts} aktif fiyat alarmı`,
        "Tüm zamanlar detaylı fiyat geçmişi",
        "Öncelikli bildirim kuyruğu",
        "Özel fırsat skoru eşikleri",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Award className="h-4 w-4" />
            <span>Yönetim</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Üyelik & Erişim Katmanları</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Sistemdeki üyelik seviyeleri, kotalar, yetkilendirme modeli ve dağılım.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 border border-zinc-800">
            <Users className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
            Toplam {totalUsers} Kullanıcı
          </span>
        </div>
      </div>

      {/* Owner Invariant Banner */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-xs text-emerald-300">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">OWNER Rolü Yetkilendirme Değişmezliği (INV-001)</p>
            <p className="mt-0.5 text-zinc-300">
              `OWNER` rolüne sahip kullanıcılar, üyelik katmanından bağımsız olarak sistemde her zaman sınırsız kota ve tam sistem erişimine sahiptir. Katman değişiklikleri OWNER yetkilerini kısıtlamaz.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {tiers.map((t) => {
          const pct = totalUsers > 0 ? Math.round((t.userCount / totalUsers) * 100) : 0;

          return (
            <div
              key={t.tier}
              className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold border ${t.badgeColor}`}
                  >
                    {t.name}
                  </span>
                  <span className="text-xs font-medium text-zinc-400">
                    {t.userCount} kullanıcı ({pct}%)
                  </span>
                </div>

                <p className="text-xs text-zinc-400 mb-4">{t.description}</p>

                <div className="space-y-2 py-3 border-t border-b border-zinc-800/80 my-3 text-xs">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">Maksimum Alarm:</span>
                    <span className="font-semibold text-white">{t.maxAlerts} adet</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">Anlık Bildirimler:</span>
                    <span className="font-semibold text-white">{t.instant ? "Aktif" : "Standart"}</span>
                  </div>
                </div>

                <ul className="space-y-1.5 mt-4">
                  {t.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800">
                <a
                  href={`/admin/users?tier=${t.tier}`}
                  className="block w-full text-center rounded-lg bg-zinc-800 hover:bg-zinc-700 py-2 text-xs font-medium text-zinc-200 transition-colors"
                >
                  Bu Katmandaki Kullanıcıları Listele
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
