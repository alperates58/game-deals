"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Layers,
  ExternalLink,
  Gamepad2,
  Bookmark,
  Check,
  TrendingDown,
  Info,
} from "lucide-react";
import { RecommendedGameItem, OwnedDlcOpportunityItem } from "@/lib/recommendations/recommendation-engine";

interface RecommendationsViewProps {
  initialRecommendations: RecommendedGameItem[];
  dlcOpportunities: OwnedDlcOpportunityItem[];
  hasSignals: boolean;
}

export function RecommendationsView({
  initialRecommendations,
  dlcOpportunities,
  hasSignals,
}: RecommendationsViewProps) {
  const [recommendations, setRecommendations] = useState<RecommendedGameItem[]>(initialRecommendations);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, "liked" | "disliked" | null>>({});

  const handleFeedback = async (gameId: string, action: "like" | "dislike") => {
    try {
      const isLike = action === "like";
      setFeedbackStatus((prev) => ({ ...prev, [gameId]: isLike ? "liked" : "disliked" }));

      await fetch("/api/user-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          liked: isLike,
          disliked: !isLike,
          ...(isLike ? { wishlist: true } : {}),
        }),
      });

      if (!isLike) {
        // Remove dismissed game from the active view with gentle transition
        setTimeout(() => {
          setRecommendations((prev) => prev.filter((r) => r.game.id !== gameId));
        }, 300);
      }
    } catch (e) {
      console.error("Feedback error:", e);
    }
  };

  return (
    <div className="space-y-12">
      {/* Fallback Banner if limited signals */}
      {!hasSignals && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-start gap-3.5">
          <Info className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300">
            <p className="font-semibold text-white">Öneri Motoru Sinyal Topluyor:</p>
            <p className="text-zinc-400 mt-1">
              Henüz kütüphanenize veya favorilerinize yeterli oyun eklemediniz. Aşağıdaki öneriler mevcut en yüksek fırsat
              skoruna sahip oyunlardan derlenmiştir. Oyunları beğendikçe (&quot;Bende Var&quot;, &quot;Favori&quot; veya &quot;👍 İlgileniyorum&quot;)
              tür ve yayıncı zevkinize göre önerileriniz otomatik olarak özelleşecektir.
            </p>
          </div>
        </div>
      )}

      {/* Recommended Games Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              Sevebileceğin Oyunlar
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Kütüphane sinyalleriniz, tür tercihleriniz ve gerçek fırsat analizine göre deterministik eşleşmeler.
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {recommendations.length} Öneri
          </span>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
            Tüm önerileri değerlendirdiniz. Yeni oyunları keşfetmek için fırsatlar sayfasına göz atabilirsiniz.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {recommendations.map(({ game, personalMatchScore, explanation }) => {
              const status = feedbackStatus[game.id];
              const isDiscounted = game.discountPercent > 0;

              return (
                <div
                  key={game.id}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-all shadow-sm ${
                    status === "disliked" ? "opacity-30 scale-95" : ""
                  }`}
                >
                  <div>
                    {/* Poster + Header */}
                    <div className="flex gap-3">
                      <Link
                        href={`/oyun/${game.slug}`}
                        className="relative h-24 w-18 shrink-0 overflow-hidden rounded-lg bg-zinc-950"
                      >
                        {game.imageUrl ? (
                          <Image
                            src={game.imageUrl}
                            alt={game.title}
                            fill
                            sizes="100px"
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-700">
                            <Gamepad2 className="h-8 w-8" />
                          </div>
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        {/* Match Score Badge */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/60">
                            %{personalMatchScore} UYUM
                          </span>
                          {game.dealScore > 0 && (
                            <span className="text-[10px] font-mono text-zinc-400">
                              Skor: {game.dealScore}/100
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/oyun/${game.slug}`}
                          className="text-sm font-semibold text-white hover:text-emerald-400 line-clamp-1 transition-colors block"
                        >
                          {game.title}
                        </Link>

                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-sm font-bold text-white">₺{game.currentPrice.toFixed(2)}</span>
                          {isDiscounted && (
                            <>
                              <span className="text-xs text-zinc-500 line-through">
                                ₺{game.listPrice.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-bold">
                                -%{game.discountPercent}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Deterministic Explanation */}
                    <div className="mt-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-2.5 text-[11px] text-zinc-300">
                      <span className="text-emerald-400 font-medium">Neden önerildi: </span>
                      {explanation}
                    </div>
                  </div>

                  {/* Feedback Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">Bu öneri nasıl?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleFeedback(game.id, "like")}
                        disabled={status !== undefined && status !== null}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          status === "liked"
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                        }`}
                        title="İstek listeme ekle ve benzerlerini öner"
                      >
                        <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                        <span>İlgi Çekici</span>
                      </button>

                      <button
                        onClick={() => handleFeedback(game.id, "dislike")}
                        disabled={status !== undefined && status !== null}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          status === "disliked"
                            ? "bg-red-950 text-red-400 border border-red-800"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-red-400"
                        }`}
                        title="Bu öneriyi kaldır ve benzerlerini azalt"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        <span>İlgilenmiyorum</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Owned Games DLC Opportunities Section */}
      {dlcOpportunities.length > 0 && (
        <div className="pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-400" />
                Sahip Olduğunuz Oyunlar İçin DLC Fırsatları
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Kütüphanenizde bulunan oyunlara ait şu anda indirimde olan resmi eklenti ve genişleme paketleri.
              </p>
            </div>
            <span className="text-xs text-blue-400 font-mono">
              {dlcOpportunities.length} Fırsat
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dlcOpportunities.map(({ parentGame, dlc }) => (
              <div
                key={dlc.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  {/* Parent Game Header Badge */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800/80 text-[11px] text-zinc-400">
                    <span className="text-zinc-500">Ana Oyun:</span>
                    <Link
                      href={`/oyun/${parentGame.slug}`}
                      className="font-medium text-white hover:text-emerald-400 line-clamp-1 transition-colors"
                    >
                      {parentGame.title}
                    </Link>
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/oyun/${dlc.slug}`}
                      className="relative h-18 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-950"
                    >
                      {dlc.imageUrl ? (
                        <Image src={dlc.imageUrl} alt={dlc.title} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-700">
                          <Layers className="h-6 w-6" />
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      <span className="rounded bg-blue-950/80 px-1.5 py-0.2 text-[9px] font-mono font-medium text-blue-300 border border-blue-800/60 uppercase">
                        {dlc.productClass}
                      </span>
                      <Link
                        href={`/oyun/${dlc.slug}`}
                        className="text-sm font-semibold text-white hover:text-blue-400 line-clamp-2 transition-colors block mt-1"
                      >
                        {dlc.title}
                      </Link>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm font-bold text-white">₺{dlc.currentPrice.toFixed(2)}</span>
                        <span className="text-xs text-zinc-500 line-through">
                          ₺{dlc.listPrice.toFixed(2)}
                        </span>
                        <span className="rounded bg-blue-950 px-1.5 py-0.2 text-[10px] font-bold text-blue-400 border border-blue-800">
                          -%{dlc.discountPercent}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-400">
                    Fırsat Skoru: <span className="text-emerald-400 font-bold">{dlc.dealScore}/100</span>
                  </span>
                  <Link
                    href={`/oyun/${dlc.slug}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Detaylar
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
