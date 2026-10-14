import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getPersonalRecommendations,
  getOwnedDlcOpportunities,
} from "@/lib/recommendations/recommendation-engine";
import { RecommendationsView } from "@/components/recommendations/recommendations-view";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Sana Özel Oyun Önerileri | Xbox Gerçek Fırsat Takip Sistemi",
  description: "Zevkinize ve kütüphanenize göre kişiselleştirilmiş indirim ve fırsat önerileri.",
};

export default async function RecommendedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/sana-ozel");
  }

  // Count user signals (owned, favorite, liked)
  const signalCount = await prisma.userGame.count({
    where: {
      userId: user.userId,
      OR: [{ owned: true }, { favorite: true }, { liked: true }],
    },
  });

  const [recommendations, dlcOpportunities] = await Promise.all([
    getPersonalRecommendations(user.userId, 12),
    getOwnedDlcOpportunities(user.userId),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Sparkles className="h-4 w-4" />
          <span>Kişiselleştirilmiş Fırsat Algoritması V1</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Sana Özel</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Xbox mağazasındaki fırsatlar arasından ilgi alanlarınıza ve kütüphanenize en çok uyanlar.
        </p>
      </div>

      <RecommendationsView
        initialRecommendations={recommendations}
        dlcOpportunities={dlcOpportunities}
        hasSignals={signalCount >= 2}
      />
    </div>
  );
}
