import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Control Center | Game Deals",
  description: "Sistem yöneticisi ve kontrol merkezi.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  if (user.role !== Role.OWNER) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-2xl border border-rose-900/60 bg-rose-950/20 p-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 mb-6">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-2">Erişim Reddedildi (403)</h1>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Admin kontrol merkezine yalnızca sistem yöneticisi (<span className="text-emerald-400 font-mono">OWNER</span>)
            rolüne sahip hesaplar erişebilir. Mevcut hesabınız ({user.email}) standart kullanıcı yetkisindedir.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  return <AdminShell userEmail={user.email}>{children}</AdminShell>;
}
