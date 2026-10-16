"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Gamepad2,
  ArrowLeft,
  Clock,
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";
import { ProductClass } from "@prisma/client";

interface GameDetailProps {
  game: {
    id: string;
    title: string;
    slug: string;
    productClass: ProductClass;
    developer: string | null;
    publisher: string | null;
    releaseDate: string | null;
    imageUrl: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    prices: any[];
    manualOverride: any | null;
    externalRatings: any[];
    subscriptions: any[];
    languageSupports: any[];
    media: any[];
    childRelationships: any[];
    parentRelationships: any[];
    stats: {
      userGames: number;
      priceAlerts: number;
    };
  };
}

export function CatalogGameDetail({ game }: GameDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "prices" | "relations" | "overrides">("overview");

  // Override form state
  const override = game.manualOverride;
  const [overrideTitle, setOverrideTitle] = useState(override?.title || "");
  const [overrideDeveloper, setOverrideDeveloper] = useState(override?.developer || "");
  const [overridePublisher, setOverridePublisher] = useState(override?.publisher || "");
  const [overrideFranchise, setOverrideFranchise] = useState(override?.franchise || "");
  const [overrideProductClass, setOverrideProductClass] = useState<string>(override?.productClass || "");
  const [overrideImageUrl, setOverrideImageUrl] = useState(override?.imageUrl || "");
  const [overrideReason, setOverrideReason] = useState(override?.reason || "");
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setMessage({ text: "Lütfen bir değişiklik gerekçesi (reason) giriniz.", type: "error" });
      return;
    }

    setIsSavingOverride(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/catalog/${game.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: overrideTitle.trim() || null,
          developer: overrideDeveloper.trim() || null,
          publisher: overridePublisher.trim() || null,
          franchise: overrideFranchise.trim() || null,
          productClass: overrideProductClass ? (overrideProductClass as ProductClass) : null,
          imageUrl: overrideImageUrl.trim() || null,
          reason: overrideReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ezme kaydedilemedi.");

      setMessage({ text: "Manuel ezme başarıyla kaydedildi.", type: "success" });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message || "Bir hata oluştu", type: "error" });
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleResetOverride = async () => {
    if (!confirm("Tüm manuel ezmeleri silip mağazadan gelen orijinal verilere dönmek istediğinize emin misiniz?")) {
      return;
    }

    setIsResetting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/catalog/${game.id}/override/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sıfırlanamadı.");

      setOverrideTitle("");
      setOverrideDeveloper("");
      setOverridePublisher("");
      setOverrideFranchise("");
      setOverrideProductClass("");
      setOverrideImageUrl("");
      setOverrideReason("");
      setMessage({ text: "Manuel ezmeler kaldırıldı ve orijinal verilere dönüldü.", type: "success" });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message || "Bir hata oluştu", type: "error" });
    } finally {
      setIsResetting(false);
    }
  };

  const currentPrice = game.prices[0];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/catalog"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kataloga Dön</span>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-xs font-medium text-zinc-400 truncate max-w-[200px] sm:max-w-md">
            {game.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {override && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Manuel Ezilmiş Ürün
            </span>
          )}
          <a
            href={`/oyun/${game.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors"
          >
            <span>Canlı Sayfada Gör</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center gap-2 border ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col md:flex-row items-start gap-5">
        {game.imageUrl ? (
          <img
            src={game.imageUrl}
            alt={game.title}
            className="h-32 w-24 object-cover rounded-lg bg-zinc-800 shadow-md shrink-0"
          />
        ) : (
          <div className="h-32 w-24 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-600">
            <Gamepad2 className="h-8 w-8" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{game.title}</h1>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              {game.productClass}
            </span>
          </div>

          <p className="text-xs text-zinc-400 font-mono">Slug: {game.slug}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div>
              <span className="text-zinc-500 block">Geliştirici:</span>
              <span className="text-zinc-200 font-medium">{game.developer || "-"}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Yayıncı:</span>
              <span className="text-zinc-200 font-medium">{game.publisher || "-"}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Mevcut Fiyat:</span>
              <span className="text-emerald-400 font-semibold font-mono">
                {currentPrice ? `₺${Number(currentPrice.currentPrice).toFixed(2)}` : "-"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Kullanıcı Takibi:</span>
              <span className="text-white font-medium">
                {game.stats.userGames} kütüphane / {game.stats.priceAlerts} alarm
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-zinc-800 space-x-1">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Info className="h-4 w-4" />
          <span>Genel Bakış</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "prices"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Fiyat Geçmişi ({game.prices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("relations")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "relations"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>İlişkiler ({game.childRelationships.length + game.parentRelationships.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("overrides")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "overrides"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Manuel Ezme (Overrides)</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Metadata ve Açıklama</h3>
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {game.description || "Açıklama bulunmuyor."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Abonelikler & Servisler</h3>
              {game.subscriptions.length === 0 ? (
                <p className="text-xs text-zinc-500">Kayıtlı abonelik servisi yok.</p>
              ) : (
                <div className="space-y-1.5">
                  {game.subscriptions.map((s: any) => (
                    <div key={s.id} className="flex justify-between text-xs bg-zinc-950 p-2.5 rounded border border-zinc-800">
                      <span className="font-semibold text-white">{s.service}</span>
                      <span className="text-emerald-400 font-medium">{s.tier || "Aktif"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Dış Derecelendirmeler</h3>
              {game.externalRatings.length === 0 ? (
                <p className="text-xs text-zinc-500">Harici derecelendirme kaydı bulunmuyor.</p>
              ) : (
                <div className="space-y-1.5">
                  {game.externalRatings.map((r: any) => (
                    <div key={r.id} className="flex justify-between text-xs bg-zinc-950 p-2.5 rounded border border-zinc-800">
                      <span className="font-semibold text-white">{r.provider}</span>
                      <span className="font-mono text-zinc-300">
                        Skor: {r.criticScore || r.userScore || "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Prices */}
      {activeTab === "prices" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Orijinal Fiyat</th>
                <th className="py-3 px-4">Satış Fiyatı</th>
                <th className="py-3 px-4">İndirim</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4">Mağaza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {game.prices.map((p: any) => (
                <tr key={p.id} className="hover:bg-zinc-800/40 font-mono">
                  <td className="py-2.5 px-4 text-zinc-400">
                    {new Date(p.recordedAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-2.5 px-4 text-zinc-500">₺{Number(p.originalPrice).toFixed(2)}</td>
                  <td className="py-2.5 px-4 font-semibold text-white">₺{Number(p.currentPrice).toFixed(2)}</td>
                  <td className="py-2.5 px-4">
                    {p.discountPercent > 0 ? (
                      <span className="text-emerald-400">-%{p.discountPercent}</span>
                    ) : (
                      <span className="text-zinc-600">0%</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {p.isCurrent ? (
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 font-sans">
                        Güncel
                      </span>
                    ) : (
                      <span className="text-zinc-600 font-sans">Geçmiş</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-zinc-400 font-sans">{p.store || "XBOX"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Relations */}
      {activeTab === "relations" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Paket İçi Oyunlar / DLC&apos;ler (Alt İlişkiler)</h3>
            {game.childRelationships.length === 0 ? (
              <p className="text-xs text-zinc-500">Bu oyuna bağlı alt içerik veya paket ürünü yok.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {game.childRelationships.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{r.childGame.title}</p>
                      <p className="text-[10px] text-zinc-500">{r.childGame.productClass}</p>
                    </div>
                    <Link
                      href={`/admin/catalog/${r.childGame.id}`}
                      className="rounded bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white"
                    >
                      İncele
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Bağlı Olduğu Üst Oyun / Paket (Üst İlişkiler)</h3>
            {game.parentRelationships.length === 0 ? (
              <p className="text-xs text-zinc-500">Bu oyun bağımsız bir ana yapıdadır.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {game.parentRelationships.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{r.parentGame.title}</p>
                      <p className="text-[10px] text-zinc-500">{r.parentGame.productClass}</p>
                    </div>
                    <Link
                      href={`/admin/catalog/${r.parentGame.id}`}
                      className="rounded bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white"
                    >
                      İncele
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Overrides */}
      {activeTab === "overrides" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs text-amber-300 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Güvenli Manuel Ezme İlkesi (ADR-003)</p>
              <p className="mt-0.5 text-zinc-300">
                Burada yapılan değişiklikler orijinal Microsoft/Steam mağaza verisini ezmez; öncelikli bir katman olarak uygulanır. Dilediğiniz an tek tıkla mağaza verilerine geri dönebilirsiniz. Her değişiklik denetim günlüğüne (AdminAuditLog) işlenir.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveOverride} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white border-b border-zinc-800 pb-3 flex items-center justify-between">
              <span>Manuel Ezme Formu</span>
              {override?.updatedByUser && (
                <span className="text-[11px] font-normal text-zinc-400">
                  Son düzenleyen: {override.updatedByUser.name} ({new Date(override.updatedAt).toLocaleString("tr-TR")})
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Özel Başlık (Custom Title)
                </label>
                <input
                  type="text"
                  placeholder={game.title}
                  value={overrideTitle}
                  onChange={(e) => setOverrideTitle(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Özel Afiş URL (Custom Image URL)
                </label>
                <input
                  type="url"
                  placeholder={game.imageUrl || "https://..."}
                  value={overrideImageUrl}
                  onChange={(e) => setOverrideImageUrl(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Geliştirici (Developer)
                </label>
                <input
                  type="text"
                  placeholder={game.developer || ""}
                  value={overrideDeveloper}
                  onChange={(e) => setOverrideDeveloper(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Yayıncı (Publisher)
                </label>
                <input
                  type="text"
                  placeholder={game.publisher || ""}
                  value={overridePublisher}
                  onChange={(e) => setOverridePublisher(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Ürün Sınıfı Ezmesi (Product Class)
                </label>
                <select
                  value={overrideProductClass}
                  onChange={(e) => setOverrideProductClass(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Orijinal Sınıfı Koru ({game.productClass})</option>
                  <option value="GAME">Ana Oyun (GAME)</option>
                  <option value="BUNDLE">Paket (BUNDLE)</option>
                  <option value="DLC">DLC / Eklenti (DLC)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Franchise / Seri
                </label>
                <input
                  type="text"
                  placeholder="Örn: Assassin's Creed, Dark Souls"
                  value={overrideFranchise}
                  onChange={(e) => setOverrideFranchise(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1">
                Değişiklik Gerekçesi (Zorunlu) *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Örn: Microsoft mağazasında eksik olan Türkçe başlık ve yüksek çözünürlüklü afiş eklendi."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              {override ? (
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleResetOverride}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-950 border border-red-700/60 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-900 transition-colors disabled:opacity-50"
                >
                  {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  <span>Ezilmeleri Sıfırla (Mağazaya Dön)</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={isSavingOverride}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {isSavingOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
                <span>Manuel Ezmeyi Kaydet</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
