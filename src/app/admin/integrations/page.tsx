import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Store, CheckCircle2, AlertTriangle, Layers, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getTelegramWebhookInfo } from "@/lib/notifications/telegram-webhook";
import { TelegramIntegrationCard } from "@/components/admin/integrations/telegram-integration-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entegrasyonlar & API | Admin",
  description: "Telegram Bot API, Xbox, Steam ve dijital mağaza entegrasyon durumları.",
};

export default async function AdminIntegrationsPage() {
  await requireOwner();

  const [totalGames, totalPrices, lastSync, telegramInfo] = await Promise.all([
    prisma.game.count(),
    prisma.priceHistory.count(),
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    getTelegramWebhookInfo(),
  ]);

  const stores = [
    {
      id: "xbox",
      name: "Microsoft Xbox Store",
      status: "ACTIVE",
      statusText: "Canlı & Aktif Entegrasyon",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      description: "Xbox Series X|S, One ve PC Microsoft Store ürünlerinin DisplayCatalog API üzerinden otomatik fiyat ve indirim taraması.",
      stats: {
        products: totalGames,
        prices: totalPrices,
        lastSync: lastSync ? new Date(lastSync.startedAt).toLocaleString("tr-TR") : "Henüz çalışmadı",
      },
      features: [
        "Otomatik Series X|S katalog keşfi",
        "Periyodik fiyat ve indirim sorgulama (DisplayCatalog API)",
        "Bundle içerik ve DLC ilişkilendirme",
        "Game Pass abonelik entegrasyonu",
      ],
    },
    {
      id: "steam",
      name: "Valve Steam Store",
      status: "NOT_CONFIGURED",
      statusText: "NOT_CONFIGURED (Faz 2)",
      badgeColor: "bg-zinc-800 text-zinc-400 border-zinc-700",
      description: "Steam Web API & Storefront API üzerinden Steam oyunlarının fiyat takibi. ALPER DESIGN OS Truthful UI prensibi gereği mock veri sunulmaz.",
      stats: { products: 0, prices: 0, lastSync: "Yapılandırılmadı" },
      features: [
        "Steam AppID eşleme mimarisi",
        "Steam Reviews & Metascore çekimi",
        "Steam topluluk pazar kuru takibi",
      ],
    },
    {
      id: "playstation",
      name: "Sony PlayStation Network (PSN)",
      status: "NOT_CONFIGURED",
      statusText: "NOT_CONFIGURED (Faz 2)",
      badgeColor: "bg-zinc-800 text-zinc-400 border-zinc-700",
      description: "PlayStation Store GraphQL API üzerinden PS4/PS5 oyunlarının fiyat ve PS Plus abonelik durumu takibi.",
      stats: { products: 0, prices: 0, lastSync: "Yapılandırılmadı" },
      features: [
        "PS5/PS4 Concept & Title ID eşleme",
        "PS Plus Essential / Extra / Deluxe desteği",
        "Bölgesel PlayStation Store TRY fiyatları",
      ],
    },
    {
      id: "epic",
      name: "Epic Games Store",
      status: "NOT_CONFIGURED",
      statusText: "NOT_CONFIGURED (Planlanan)",
      badgeColor: "bg-zinc-800 text-zinc-400 border-zinc-700",
      description: "Epic Games Store GraphQL API ile haftalık ücretsiz oyunlar ve kupon indirimleri takibi.",
      stats: { products: 0, prices: 0, lastSync: "Yapılandırılmadı" },
      features: [
        "Haftalık ücretsiz oyun alarmları",
        "Epic kupon indirim hesaplama motoru",
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Layers className="h-4 w-4" />
            <span>Entegrasyon Yönetimi</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sistem & Mağaza Entegrasyonları</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Telegram bot bildirim kanalı ve dijital oyun mağazası API sağlayıcılarının anlık bağlantı durumları.
          </p>
        </div>
      </div>

      {/* Telegram Webhook Self-Management Card */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Bildirim Kanalları & Bot Servisleri
        </h2>
        <TelegramIntegrationCard initialInfo={telegramInfo} />
      </section>

      {/* Store Integrations Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Dijital Mağaza Entegrasyonları
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {stores.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                s.status === "ACTIVE"
                  ? "border-emerald-500/30 bg-zinc-900/80 shadow-lg shadow-emerald-950/20"
                  : "border-zinc-800 bg-zinc-900/40 opacity-80"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-white">{s.name}</h3>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-semibold border ${s.badgeColor}`}>
                    {s.statusText}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 mb-4">{s.description}</p>

                {s.status === "ACTIVE" ? (
                  <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs mb-4">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Aktif Ürün</span>
                      <span className="font-semibold text-white font-mono">{s.stats.products}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Fiyat Kaydı</span>
                      <span className="font-semibold text-white font-mono">{s.stats.prices}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Son Senkron</span>
                      <span className="font-medium text-emerald-400 font-mono text-[11px] truncate block">
                        {s.stats.lastSync}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5 text-xs text-zinc-300">
                  <p className="text-zinc-500 text-[11px] font-semibold uppercase">Özellikler & Kapsam:</p>
                  {s.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 ${
                          s.status === "ACTIVE" ? "text-emerald-400" : "text-zinc-600"
                        }`}
                      />
                      <span className={s.status === "ACTIVE" ? "text-zinc-300" : "text-zinc-500"}>
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-zinc-800/80 flex justify-between items-center text-xs">
                {s.status === "ACTIVE" ? (
                  <Link
                    href="/admin/operations/scheduler"
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Zamanlayıcıyı Yönet</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-[11px] text-zinc-500">Geliştirme Planında</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
