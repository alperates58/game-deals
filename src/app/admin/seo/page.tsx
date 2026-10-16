import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { Search, ExternalLink, Globe, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "SEO & Arama Motoru İndeksleme | Admin",
  description: "Sitemap, robots.txt ve meta etiket analizleri.",
};

export default async function AdminSeoPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Search className="h-4 w-4" />
            <span>Site</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SEO & Arama Motoru Yönetimi</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Arama motoru indeksleme durumu, robots.txt kuralları ve site haritası bağlantıları.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Robots.txt Kuralları</h3>
            <a
              href="/robots.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>robots.txt Aç</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800 font-mono text-[11px] text-zinc-300 space-y-1">
            <p>User-agent: *</p>
            <p>Allow: /</p>
            <p>Disallow: /admin/</p>
            <p>Disallow: /ayarlar/</p>
            <p>Disallow: /api/</p>
            <p className="text-zinc-500 pt-2"># Admin ve kullanıcı gizliliği indeksleme dışıdır</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Sitemap.xml</h3>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>sitemap.xml Aç</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-zinc-400">
            Dinamik sitemap.xml tüm popüler oyunları, indirim sayfalarını ve ana rotaları arama motorlarına iletir.
          </p>
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>Otomatik Dinamik Güncelleme Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
}
