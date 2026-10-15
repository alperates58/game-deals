import { prisma } from "@/lib/db/prisma";
import { GameCard } from "@/components/game/game-card";
import { Clock, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoricalLowsPage() {
  const games = await prisma.game.findMany({
    where: {
      isActive: true,
      discountPercent: { gt: 0 },
    },
    include: {
      dealAnalysis: true,
    },
    orderBy: [
      { dealAnalysis: { dealScore: "desc" } },
      { discountPercent: "desc" },
    ],
  });

  // Filter truthfully
  const verifiedLows = games.filter(
    (g) => g.currentPrice.toNumber() <= g.historicalLow.toNumber()
  );

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Clock className="h-4 w-4" />
          Tarihi Fiyat Rekorları
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Takip Başladığından Beri En Düşük Fiyattakiler
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
          Aşağıdaki oyunlar şu anda sistemimizin takibe aldığı tarihten bu yana gördüğü en düşük fiyata inmiştir.
        </p>

        {/* Truthful UI Banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200/90">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Dürüst Veri İlkesi:</strong> &ldquo;Tarihi Dip&rdquo;, sistemimizin bu oyunu ilk gözlemlediği tarihten itibaren geçerlidir. Oyunun sistemimiz kurulmadan önceki yıllara ait indirimi varsa bu veride yer almaz; varsayım yapılmaz.
          </span>
        </div>
      </div>

      {/* Grid */}
      {verifiedLows.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {verifiedLows.map((game) => (
            <GameCard key={game.id} {...game} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-base font-semibold text-zinc-300">Şu Anda Tarihi Dipte Oyun Yok</p>
          <p className="mt-1 text-xs text-zinc-400">
            Aktif indirimlerin fiyatları geçmiş gözlemlerimizin üzerinde seyrediyor.
          </p>
        </div>
      )}
    </div>
  );
}
