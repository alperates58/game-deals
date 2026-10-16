import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Globe, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dil Desteği & Yerelleştirme | Admin",
  description: "Türkçe dublaj, altyazı ve arayüz desteği olan oyunların analizi.",
};

export default async function AdminLanguagesPage() {
  await requireOwner();

  const [turkishSupports, totalSupports] = await Promise.all([
    prisma.gameLanguageSupport.findMany({
      where: { languageCode: "TR" },
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: {
        game: {
          select: { id: true, title: true, slug: true, imageUrl: true },
        },
      },
    }),
    prisma.gameLanguageSupport.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Globe className="h-4 w-4" />
            <span>Katalog Metadata</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dil Desteği & Yerelleştirme (Languages)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Türkçe seslendirme (dublaj), altyazı ve arayüz desteğine sahip oyunlar.
          </p>
        </div>

        <span className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
          Toplam {totalSupports} Eşleme
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Oyun</th>
              <th className="py-3 px-4">Dil</th>
              <th className="py-3 px-4">Seslendirme (Dublaj)</th>
              <th className="py-3 px-4">Altyazı</th>
              <th className="py-3 px-4">Arayüz</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {turkishSupports.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  Henüz dil desteği kaydı bulunmuyor.
                </td>
              </tr>
            ) : (
              turkishSupports.map((ls) => (
                <tr key={ls.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{ls.game.title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{ls.game.slug}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/20">
                      {ls.languageCode}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {ls.audioSupported ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Var
                      </span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {ls.subtitlesSupported ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Var
                      </span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {ls.interfaceSupported ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Var
                      </span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/admin/catalog/${ls.game.id}`}
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
