import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Activity, CheckCircle2, Server, Cpu, Database, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Sistem Sağlığı & Tanılama | Admin",
  description: "Sunucu kaynakları, veritabanı gecikmesi ve çalışma zamanı profili.",
};

export default async function AdminSystemHealthPage() {
  await requireOwner();

  const startDb = Date.now();
  let dbLatency = 0;
  let dbStatus = "OK";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - startDb;
  } catch (e: any) {
    dbStatus = "ERROR";
  }

  const mem = process.memoryUsage();
  const formatMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Activity className="h-4 w-4" />
            <span>Sistem</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sistem Sağlığı & Tanılama (Diagnostics)</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Node.js çalışma zamanı, bellek tahsisleri, veritabanı yanıt süresi ve ortam durumu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Database className="h-4 w-4 text-emerald-400" />
            PostgreSQL Yanıtı
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-2">
            {dbStatus === "OK" ? `${dbLatency} ms` : "HATA"}
          </p>
          <span className="text-[10px] text-emerald-400 font-medium">Bağlantı Sağlıklı</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-blue-400" />
            Bellek (RSS)
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-2">{formatMb(mem.rss)} MB</p>
          <span className="text-[10px] text-zinc-400">Heap: {formatMb(mem.heapUsed)} / {formatMb(mem.heapTotal)} MB</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Server className="h-4 w-4 text-purple-400" />
            Node.js Sürümü
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-2">{process.version}</p>
          <span className="text-[10px] text-zinc-400">Platform: {process.platform}</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-amber-400" />
            Çalışma Ortamı
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-2">{process.env.NODE_ENV || "production"}</p>
          <span className="text-[10px] text-zinc-400">Uptime: {(process.uptime() / 60).toFixed(0)} dk</span>
        </div>
      </div>
    </div>
  );
}
