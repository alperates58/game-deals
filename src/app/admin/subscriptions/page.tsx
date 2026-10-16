import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Layers, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { SubscriptionService } from "@prisma/client";

export const metadata: Metadata = {
  title: "Abonelik Kütüphaneleri | Admin",
  description: "Xbox Game Pass, EA Play, Ubisoft+ ve abonelik katalogları.",
};

export default async function AdminSubscriptionsPage() {
  await requireOwner();

  const [serviceCountsRaw, subscriptions] = await Promise.all([
    prisma.gameSubscription.groupBy({
      by: ["service"],
      _count: { id: true },
    }),
    prisma.gameSubscription.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: {
        game: {
          select: { id: true, title: true, slug: true, imageUrl: true, productClass: true },
        },
      },
    }),
  ]);

  const serviceCounts: Record<string, number> = {};
  serviceCountsRaw.forEach((sc) => {
    serviceCounts[sc.service] = sc._count.id;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Layers className="h-4 w-4" />
            <span>Katalog Metadata</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Abonelik Servisleri (Subscriptions)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Xbox Game Pass, EA Play ve diğer abonelik kataloglarına dahil olan oyunlar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 font-medium">Xbox Game Pass</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {serviceCounts[SubscriptionService.GAME_PASS] || 0} oyun
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 font-medium">EA Play</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {serviceCounts[SubscriptionService.EA_PLAY] || 0} oyun
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-400 font-medium">PlayStation Plus</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {serviceCounts[SubscriptionService.PS_PLUS] || 0} oyun
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Oyun</th>
              <th className="py-3 px-4">Servis</th>
              <th className="py-3 px-4">Katman</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-500">
                  Henüz abonelik servisi eşlemesi bulunmuyor.
                </td>
              </tr>
            ) : (
              subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{s.game.title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{s.game.slug}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                      {s.service}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-300">{s.tier || "Standard"}</td>
                  <td className="py-3 px-4">
                    {s.isActive ? (
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                        Aktif Dahil
                      </span>
                    ) : (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                        Ayrıldı
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/catalog/${s.game.id}`}
                      className="rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors"
                    >
                      Oyuna Git
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
