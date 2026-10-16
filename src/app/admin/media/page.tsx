import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Image as ImageIcon, Film, Play, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Medya Galerisi & Varlıklar | Admin",
  description: "Ekran görüntüleri, fragmanlar ve afiş CDN durumu.",
};

export default async function AdminMediaPage() {
  await requireOwner();

  const [mediaList, totalMedia] = await Promise.all([
    prisma.gameMedia.findMany({
      take: 40,
      orderBy: { createdAt: "desc" },
      include: {
        game: {
          select: { id: true, title: true, slug: true },
        },
      },
    }),
    prisma.gameMedia.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <ImageIcon className="h-4 w-4" />
            <span>Katalog Metadata</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Medya & Görsel Varlıklar</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Katalogdaki oyunlara ait ekran görüntüleri, fragmanlar ve afişler.
          </p>
        </div>

        <span className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
          Toplam {totalMedia} Medya Öğesi
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {mediaList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-zinc-500">
            Henüz medya galerisi kaydı bulunmuyor.
          </div>
        ) : (
          mediaList.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col justify-between"
            >
              <div className="aspect-video bg-zinc-950 relative flex items-center justify-center overflow-hidden">
                {m.type === "TRAILER" ? (
                  <div className="flex flex-col items-center justify-center text-zinc-500">
                    <Film className="h-8 w-8 mb-1" />
                    <span className="text-[10px]">Video Fragman</span>
                  </div>
                ) : (
                  <img
                    src={m.url}
                    alt={m.title || "Medya"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {m.type}
                </span>
              </div>

              <div className="p-3 space-y-1">
                <p className="font-semibold text-white text-xs truncate">{m.game.title}</p>
                <p className="text-[10px] text-zinc-400 truncate">{m.title || "Açıklama yok"}</p>
                <div className="pt-2 flex justify-between items-center text-[10px]">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Gör</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Link href={`/admin/catalog/${m.game.id}`} className="text-zinc-400 hover:text-white">
                    Oyuna Git
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
