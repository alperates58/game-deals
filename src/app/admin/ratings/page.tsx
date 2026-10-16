import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Star, Award, Layers, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Harici Derecelendirmeler | Admin",
  description: "Metacritic, OpenCritic ve mağaza skorları dağılımı.",
};

export default async function AdminRatingsPage() {
  await requireOwner();

  const [ratingsCount, ratings] = await Promise.all([
    prisma.externalRating.count(),
    prisma.externalRating.findMany({
      take: 50,
      orderBy: { criticScore: "desc" },
      include: {
        game: {
          select: { id: true, title: true, slug: true, imageUrl: true, productClass: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Star className="h-4 w-4" />
            <span>Katalog Metadata</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Harici Derecelendirmeler (Ratings)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            OpenCritic, Metacritic ve diğer sağlayıcılardan toplanan eleştirmen/kullanıcı puanları.
          </p>
        </div>

        <span className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
          Toplam {ratingsCount} Skor Kaydı
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Oyun</th>
              <th className="py-3 px-4">Sağlayıcı</th>
              <th className="py-3 px-4">Eleştirmen Skoru</th>
              <th className="py-3 px-4">Kullanıcı Skoru</th>
              <th className="py-3 px-4">İnceleme Sayısı</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {ratings.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  Henüz harici derecelendirme kaydı bulunmuyor.
                </td>
              </tr>
            ) : (
              ratings.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{r.game.title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{r.game.slug}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                      {r.provider}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                    {r.criticScore ? `${r.criticScore} / 100` : "-"}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-300">
                    {r.userScore ? `${r.userScore} / 10` : "-"}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-400">{r.reviewCount || "-"}</td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/catalog/${r.game.id}`}
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
