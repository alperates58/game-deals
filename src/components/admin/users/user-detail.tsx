"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Send,
  Gamepad2,
  Bell,
  Sparkles,
  ArrowLeft,
  Loader2,
  Calendar,
  Layers,
  Inbox,
} from "lucide-react";
import { Role, AccountStatus, MembershipTier } from "@prisma/client";

interface UserDetailProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: Role;
    accountStatus: AccountStatus;
    membershipTier: MembershipTier;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
    hasPassword: boolean;
    accounts: { id: string; provider: string; createdAt: string }[];
    telegramConnection: {
      isActive: boolean;
      telegramUsername: string | null;
      displayName: string | null;
      linkedAt: string;
    } | null;
    stats: {
      gamesCount: number;
      alertsCount: number;
      notificationsCount: number;
      deliveriesCount: number;
    };
    recentAlerts: any[];
    recentGames: any[];
  };
}

export function UserDetail({ user: initialUser }: UserDetailProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);

  const [role, setRole] = useState<Role>(initialUser.role);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(initialUser.accountStatus);
  const [membershipTier, setMembershipTier] = useState<MembershipTier>(initialUser.membershipTier);
  const [reason, setReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          accountStatus,
          membershipTier,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser((prev) => ({
          ...prev,
          role,
          accountStatus,
          membershipTier,
        }));
        setMessage({ success: true, text: "Kullanıcı durumu başarıyla güncellendi." });
        setReason("");
        router.refresh();
      } else {
        setMessage({ success: false, text: data.error || "Güncelleme başarısız." });
      }
    } catch {
      setMessage({ success: false, text: "Ağ bağlantı hatası." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{user.name}</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">{user.email} • ID: {user.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
              user.accountStatus === AccountStatus.ACTIVE
                ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                : "bg-rose-950/80 text-rose-400 border-rose-800/60"
            }`}
          >
            {user.accountStatus === AccountStatus.ACTIVE ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {user.accountStatus}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl p-4 flex items-center gap-3 text-xs ${
            message.success
              ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
          }`}
        >
          {message.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grid: Details & Mutation Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identity & Accounts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Stats */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">
              Kullanıcı Özeti & Metrikler
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                <span className="text-[11px] text-zinc-400 block mb-1">Kütüphane</span>
                <span className="text-lg font-bold text-white font-mono">{user.stats.gamesCount}</span>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                <span className="text-[11px] text-zinc-400 block mb-1">Aktif Alarmlar</span>
                <span className="text-lg font-bold text-white font-mono">{user.stats.alertsCount}</span>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                <span className="text-[11px] text-zinc-400 block mb-1">Gelen Kutusu</span>
                <span className="text-lg font-bold text-white font-mono">{user.stats.notificationsCount}</span>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                <span className="text-[11px] text-zinc-400 block mb-1">Teslimat Kuyruğu</span>
                <span className="text-lg font-bold text-white font-mono">{user.stats.deliveriesCount}</span>
              </div>
            </div>

            <div className="pt-2 divide-y divide-zinc-800/60 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-zinc-400">E-posta Doğrulaması:</span>
                <span className="font-semibold text-zinc-200">
                  {user.emailVerifiedAt ? `Doğrulandı (${new Date(user.emailVerifiedAt).toLocaleDateString("tr-TR")})` : "Doğrulanmamış"}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-zinc-400">Kayıt Tarihi:</span>
                <span className="font-semibold text-zinc-200">{new Date(user.createdAt).toLocaleString("tr-TR")}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-zinc-400">Son Giriş:</span>
                <span className="font-semibold text-zinc-200">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("tr-TR") : "Henüz giriş yapmadı"}
                </span>
              </div>
            </div>
          </div>

          {/* Connected Channels & Accounts */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">
              Giriş Sağlayıcıları ve Dış Kanallar
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Google OAuth */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Google OAuth</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      user.accounts.some((a) => a.provider === "GOOGLE")
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {user.accounts.some((a) => a.provider === "GOOGLE") ? "Bağlı" : "Bağlı Değil"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Google hesabı ile tek tıkla giriş desteği.
                </p>
              </div>

              {/* Password */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Yerel Şifre</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      user.hasPassword
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                    }`}
                  >
                    {user.hasPassword ? "Mevcut" : "Yok"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Parola hash&apos;i asla istemciye veya loglara aktarılmaz.
                </p>
              </div>

              {/* Telegram */}
              <div className="sm:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-sky-400" />
                    <span>Telegram Entegrasyonu</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      user.telegramConnection?.isActive
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {user.telegramConnection?.isActive ? "Aktif" : "Bağlı Değil"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {user.telegramConnection
                    ? `Kullanıcı Adı: @${user.telegramConnection.telegramUsername || "Gizli"} • Bağlandı: ${new Date(user.telegramConnection.linkedAt).toLocaleDateString("tr-TR")}`
                    : "Kullanıcı henüz Telegram botunu bağlamamış."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Admin Actions with Owner Safety */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>Yönetici Müdahalesi</span>
            </h2>

            <form onSubmit={handleUpdate} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Hesap Rolü</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={Role.USER}>USER (Standart Kullanıcı)</option>
                  <option value={Role.OWNER}>OWNER (Sistem Yöneticisi)</option>
                </select>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Hesap Durumu</label>
                <select
                  value={accountStatus}
                  onChange={(e) => setAccountStatus(e.target.value as AccountStatus)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={AccountStatus.ACTIVE}>ACTIVE (Aktif)</option>
                  <option value={AccountStatus.SUSPENDED}>SUSPENDED (Askıya Alınmış)</option>
                </select>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Askıya alınan hesaplar hem parola hem Google ile giriş yapamaz.
                </span>
              </div>

              {/* Membership Tier */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Üyelik Seviyesi (Test/Geliştirme)</label>
                <select
                  value={membershipTier}
                  onChange={(e) => setMembershipTier(e.target.value as MembershipTier)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={MembershipTier.FREE}>FREE (Standart)</option>
                  <option value={MembershipTier.PRO}>PRO (Gelişmiş)</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">İşlem Gerekçesi (Audit Log)</label>
                <input
                  type="text"
                  placeholder="Örn: Güvenlik incelemesi veya rol yükseltme"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Değişiklikleri Uygula</span>
                </button>
              </div>
            </form>

            <div className="p-3.5 rounded-xl border border-amber-900/40 bg-amber-950/20 text-[11px] text-amber-300/90 leading-relaxed">
              <strong className="block mb-0.5 text-amber-200">Owner Safety Kuralı:</strong>
              Son OWNER kullanıcısı düşürülemez veya askıya alınamaz. Kendinizi askıya alamazsınız.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
