import Link from "next/link";
import { isRegistrationAllowed } from "@/lib/settings/system-settings";
import { RegisterForm } from "@/components/auth/register-form";
import { ShieldAlert, Gamepad2 } from "lucide-react";

export const metadata = {
  title: "Kayıt Ol | Xbox Fırsat",
  description: "Kişisel Xbox oyun merkezinizi oluşturun, kütüphanenizi ve fiyat alarmlarınızı yönetin.",
};

export default async function RegisterPage() {
  const allowed = await isRegistrationAllowed();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
            <Gamepad2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Kişisel Oyun Merkezinize Katılın
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Kütüphanenizi takip edin, fiyat alarmları kurun ve size özel indirimleri yakalayın.
          </p>
        </div>

        {!allowed ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 text-center space-y-3">
            <ShieldAlert className="h-8 w-8 text-amber-400 mx-auto" />
            <h3 className="text-sm font-bold text-amber-300">Kayıtlar Şu Anda Kapalıdır</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Bu sistem kişisel ve sınırlı erişim için yapılandırılmıştır. Yeni üye kaydı şu anda yönetici tarafından durdurulmuştur.
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
            >
              Giriş Yap Sayfasına Dön
            </Link>
          </div>
        ) : (
          <RegisterForm />
        )}
      </div>
    </div>
  );
}
