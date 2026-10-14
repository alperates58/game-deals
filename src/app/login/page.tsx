import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { LogIn } from "lucide-react";

export const metadata = {
  title: "Giriş Yap | Xbox Fırsat",
  description: "Kişisel Xbox oyun merkezinize giriş yapın.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Hesabınıza Giriş Yapın
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Kütüphaneniz, favorileriniz ve fiyat alarmlarınız parmaklarınızın ucunda.
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
