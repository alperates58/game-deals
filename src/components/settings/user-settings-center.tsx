"use client";

import { useState } from "react";
import {
  User,
  Shield,
  Bell,
  Mail,
  Send,
  Moon,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
  Lock,
  Smartphone,
  MessageSquare,
} from "lucide-react";
import { NotificationChannel, NotificationEventType, PriceAlertType } from "@prisma/client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  membershipTier: string;
  accountStatus: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  isGoogleLinked: boolean;
  hasPassword: boolean;
}

interface TelegramConnectionInfo {
  isActive: boolean;
  telegramUsername: string | null;
  displayName: string | null;
  linkedAt: string;
}

interface NotificationSettingsInfo {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  defaultAlertType: PriceAlertType;
  defaultLanguage: string;
  defaultCurrency: string;
}

interface UserSettingsCenterProps {
  initialUser: UserProfile;
  initialTelegram: TelegramConnectionInfo | null;
  initialNotificationSettings: NotificationSettingsInfo;
  initialMatrix: Record<string, Record<string, boolean>>;
  isEmailConfigured: boolean;
  isTelegramConfigured: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  PRICE_DROP: "Fiyat Düştüğünde",
  ALERT_MATCHED: "Fiyat Alarmım Çaldığında",
  NEW_OBSERVED_LOW: "Yeni Tarihi Dip Fiyat Olduğunda",
  DEAL_SCORE_THRESHOLD: "Fırsat Skoru Hedefime Ulaştığında",
  OWNED_GAME_DLC_DEAL: "Sahip Olduğum Oyuna DLC İndirimi Geldiğinde",
  WISHLIST_DEAL: "İstek Listemdeki Oyun İndirime Girdiğinde",
  FAVORITE_PRICE_CHANGE: "Favori Oyunlarımda Fiyat Değiştiğinde",
};

export type SettingsTabId = "account" | "security" | "notifications" | "channels" | "quiet" | "defaults";

export const SETTINGS_TABS: { id: SettingsTabId; label: string; fullLabel: string; icon: any }[] = [
  { id: "account", label: "Hesap", fullLabel: "Hesap Bilgileri", icon: User },
  { id: "security", label: "Güvenlik", fullLabel: "Giriş & Güvenlik", icon: Shield },
  { id: "notifications", label: "Bildirimler", fullLabel: "Bildirim Tercihleri", icon: Bell },
  { id: "channels", label: "Kanallar", fullLabel: "Bildirim Kanalları", icon: Send },
  { id: "quiet", label: "Sessiz Saatler", fullLabel: "Sessiz Saatler", icon: Moon },
  { id: "defaults", label: "Varsayılanlar", fullLabel: "Varsayılanlar & Bölge", icon: Sliders },
];

export function UserSettingsCenter({
  initialUser,
  initialTelegram,
  initialNotificationSettings,
  initialMatrix,
  isEmailConfigured,
  isTelegramConfigured,
}: UserSettingsCenterProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("account");

  // Profile state
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [avatarUrl, setAvatarUrl] = useState(initialUser.avatarUrl || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Telegram state
  const [telegram, setTelegram] = useState<TelegramConnectionInfo | null>(initialTelegram);
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Email verification state
  const [emailVerified, setEmailVerified] = useState(Boolean(initialUser.emailVerifiedAt));
  const [isSendingEmailVerification, setIsSendingEmailVerification] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Notification Matrix
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(initialMatrix);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [matrixMessage, setMatrixMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Quiet Hours & Defaults
  const [quietHours, setQuietHours] = useState<NotificationSettingsInfo>(initialNotificationSettings);
  const [isSavingQuiet, setIsSavingQuiet] = useState(false);
  const [quietMessage, setQuietMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarUrl: avatarUrl.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => ({ ...prev, name, avatarUrl: avatarUrl.trim() || null }));
        setProfileMessage({ success: true, text: "Profil bilgileriniz başarıyla güncellendi." });
      } else {
        setProfileMessage({ success: false, text: data.error || "Güncelleme başarısız." });
      }
    } catch {
      setProfileMessage({ success: false, text: "Ağ hatası oluştu." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Matrix Toggle Handler
  const handleMatrixToggle = (eventType: string, channel: NotificationChannel) => {
    setMatrix((prev) => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [channel]: !prev[eventType]?.[channel],
      },
    }));
  };

  // Save Matrix Handler
  const handleSaveMatrix = async () => {
    setIsSavingMatrix(true);
    setMatrixMessage(null);
    try {
      const preferences: { eventType: NotificationEventType; channel: NotificationChannel; enabled: boolean }[] = [];
      for (const [eventType, channels] of Object.entries(matrix)) {
        for (const [channel, enabled] of Object.entries(channels)) {
          preferences.push({
            eventType: eventType as NotificationEventType,
            channel: channel as NotificationChannel,
            enabled: Boolean(enabled),
          });
        }
      }

      const res = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json();
      if (res.ok) {
        setMatrixMessage({ success: true, text: "Bildirim tercihleriniz başarıyla kaydedildi." });
      } else {
        setMatrixMessage({ success: false, text: data.error || "Kaydedilemedi." });
      }
    } catch {
      setMatrixMessage({ success: false, text: "Ağ hatası oluştu." });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Telegram Connect Link
  const handleConnectTelegram = async () => {
    setIsLinkingTelegram(true);
    setTelegramMessage(null);
    try {
      const res = await fetch("/api/notifications/telegram/link-token", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.linkUrl) {
        window.open(data.linkUrl, "_blank");
        setTelegramMessage({
          success: true,
          text: "Telegram botu açıldı. Lütfen bot penceresinde 'Başlat' (Start) butonuna basarak bağlantıyı tamamlayınız.",
        });
      } else {
        setTelegramMessage({ success: false, text: data.error || "Bağlantı başlatılamadı." });
      }
    } catch {
      setTelegramMessage({ success: false, text: "Ağ hatası oluştu." });
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  // Telegram Disconnect
  const handleDisconnectTelegram = async () => {
    if (!confirm("Telegram bağlantısını kesmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch("/api/notifications/telegram/disconnect", { method: "POST" });
      if (res.ok) {
        setTelegram(null);
        setTelegramMessage({ success: true, text: "Telegram bağlantınız kesildi." });
      }
    } catch {
      setTelegramMessage({ success: false, text: "İşlem başarısız oldu." });
    }
  };

  // Telegram Test
  const handleTestTelegram = async () => {
    setTelegramMessage(null);
    try {
      const res = await fetch("/api/notifications/telegram/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTelegramMessage({ success: true, text: "Test bildirimi Telegram hesabınıza gönderildi!" });
      } else {
        setTelegramMessage({ success: false, text: data.error || "Test gönderilemedi." });
      }
    } catch {
      setTelegramMessage({ success: false, text: "Ağ hatası oluştu." });
    }
  };

  // Email Send Verification
  const handleSendEmailVerification = async () => {
    setIsSendingEmailVerification(true);
    setEmailMessage(null);
    try {
      const res = await fetch("/api/notifications/email/send-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEmailMessage({ success: true, text: "Doğrulama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz." });
      } else {
        setEmailMessage({ success: false, text: data.error || "Gönderilemedi." });
      }
    } catch {
      setEmailMessage({ success: false, text: "Ağ hatası oluştu." });
    } finally {
      setIsSendingEmailVerification(false);
    }
  };

  // Email Test
  const handleTestEmail = async () => {
    setEmailMessage(null);
    try {
      const res = await fetch("/api/notifications/email/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEmailMessage({ success: true, text: "Test e-postası başarıyla gönderildi!" });
      } else {
        setEmailMessage({ success: false, text: data.error || "Test e-postası gönderilemedi." });
      }
    } catch {
      setEmailMessage({ success: false, text: "Ağ hatası oluştu." });
    }
  };

  // Save Quiet Hours & Defaults
  const handleSaveQuietHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingQuiet(true);
    setQuietMessage(null);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationSettings: quietHours }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuietMessage({ success: true, text: "Sessiz saatler ve tercihler kaydedildi." });
      } else {
        setQuietMessage({ success: false, text: data.error || "Kaydedilemedi." });
      }
    } catch {
      setQuietMessage({ success: false, text: "Ağ hatası oluştu." });
    } finally {
      setIsSavingQuiet(false);
    }
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">
      {/* Mobile Horizontal Scroll Tab Bar (< lg) */}
      <div className="lg:hidden w-full">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm"
                    : "bg-zinc-900/90 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Sidebar Navigation (lg+) */}
      <div className="hidden lg:block lg:col-span-1 space-y-1">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.fullLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-6 min-w-0">
        {/* TAB 1: ACCOUNT */}
        {activeTab === "account" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Hesap Bilgileri</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Kişisel profilinizi ve kimlik detaylarınızı yönetin.</p>
            </div>

            {profileMessage && (
              <div
                className={`rounded-xl p-3.5 flex items-center gap-2.5 text-xs ${
                  profileMessage.success
                    ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                    : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
                }`}
              >
                {profileMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Ad Soyad</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">E-posta Adresi</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  E-posta adresi güvenli kimlik doğrulaması gerektirdiği için doğrudan değiştirilemez.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Profil Fotoğrafı URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="pt-2 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>
            </form>

            <div className="pt-6 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <span className="text-[11px] text-zinc-400 block mb-1">Üyelik Seviyesi</span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 text-xs font-bold text-emerald-400">
                  <Sparkles className="h-3 w-3" />
                  {user.membershipTier}
                </span>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <span className="text-[11px] text-zinc-400 block mb-1">Hesap Rolü</span>
                <span className="text-xs font-semibold text-zinc-200">{user.role}</span>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <span className="text-[11px] text-zinc-400 block mb-1">Kayıt Tarihi</span>
                <span className="text-xs font-semibold text-zinc-200">
                  {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY */}
        {activeTab === "security" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Giriş ve Güvenlik</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Hesabınıza bağlı giriş yöntemleri ve oturum güvenliği.</p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-white font-bold text-sm">
                    G
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white">Google ile Giriş</h3>
                    <p className="text-[11px] text-zinc-400">
                      {user.isGoogleLinked ? "Google hesabınız bu hesaba bağlı." : "Google hesabı bağlı değil."}
                    </p>
                  </div>
                </div>

                <span
                  className={`self-start sm:self-auto shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold border ${
                    user.isGoogleLinked
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                      : "bg-zinc-800/50 text-zinc-400 border-zinc-700/60"
                  }`}
                >
                  {user.isGoogleLinked ? "Bağlı" : "Bağlı Değil"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white">Hesap Şifresi</h3>
                    <p className="text-[11px] text-zinc-400">
                      {user.hasPassword ? "Hesabınız için parola belirlenmiş." : "Google ile oluşturuldu (Parola yok)."}
                    </p>
                  </div>
                </div>

                <span
                  className={`self-start sm:self-auto shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold border ${
                    user.hasPassword
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                      : "bg-amber-950/80 text-amber-400 border-amber-800/60"
                  }`}
                >
                  {user.hasPassword ? "Aktif" : "Parola Belirlenmedi"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS MATRIX */}
        {activeTab === "notifications" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Olay Tercihleri ve Matris</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Hangi olayların hangi kanaldan iletileceğini seçin.</p>
              </div>

              <button
                type="button"
                disabled={isSavingMatrix}
                onClick={handleSaveMatrix}
                className="self-start sm:self-auto rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-950/40 shrink-0"
              >
                {isSavingMatrix ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>Tercihleri Kaydet</span>
              </button>
            </div>

            {matrixMessage && (
              <div
                className={`rounded-xl p-3.5 flex items-center gap-2.5 text-xs ${
                  matrixMessage.success
                    ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                    : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
                }`}
              >
                {matrixMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{matrixMessage.text}</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[460px] text-left text-xs">
                <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="p-3 sm:p-3.5">Olay Türü</th>
                    <th className="p-3 sm:p-3.5 text-center">Uygulama İçi</th>
                    <th className="p-3 sm:p-3.5 text-center">E-posta</th>
                    <th className="p-3 sm:p-3.5 text-center">Telegram</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                  {Object.entries(EVENT_LABELS).map(([evt, label]) => {
                    const inAppChecked = matrix[evt]?.[NotificationChannel.IN_APP] ?? true;
                    const emailChecked = matrix[evt]?.[NotificationChannel.EMAIL] ?? true;
                    const telegramChecked = matrix[evt]?.[NotificationChannel.TELEGRAM] ?? true;

                    const canEmail = emailVerified && isEmailConfigured;
                    const canTelegram = telegram?.isActive && isTelegramConfigured;

                    return (
                      <tr key={evt} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-3 sm:p-3.5 font-semibold text-zinc-200">{label}</td>

                        {/* In-App */}
                        <td className="p-3 sm:p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={inAppChecked}
                            onChange={() => handleMatrixToggle(evt, NotificationChannel.IN_APP)}
                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Email */}
                        <td className="p-3 sm:p-3.5 text-center" title={!canEmail ? "E-posta henüz doğrulanmadı veya sunucu yapılandırılmadı." : ""}>
                          <input
                            type="checkbox"
                            disabled={!canEmail}
                            checked={canEmail && emailChecked}
                            onChange={() => handleMatrixToggle(evt, NotificationChannel.EMAIL)}
                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Telegram */}
                        <td className="p-3 sm:p-3.5 text-center" title={!canTelegram ? "Telegram hesabı henüz bağlanmadı veya bot yapılandırılmadı." : ""}>
                          <input
                            type="checkbox"
                            disabled={!canTelegram}
                            checked={canTelegram && telegramChecked}
                            onChange={() => handleMatrixToggle(evt, NotificationChannel.TELEGRAM)}
                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CHANNELS */}
        {activeTab === "channels" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Bildirim Kanalları</h2>
              <p className="text-xs text-zinc-400 mt-0.5">E-posta, Telegram ve diğer iletişim kanallarınızı yapılandırın.</p>
            </div>

            {/* Telegram Channel Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-950/60 border border-sky-800/60 text-sky-400">
                    <Send className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white">Telegram Bot Bildirimleri</h3>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {telegram?.isActive
                        ? `Bağlı hesap: @${telegram.telegramUsername || telegram.displayName || "Kullanıcı"}`
                        : "Telegram hesabınızı bağlayarak anlık fırsat mesajları alın."}
                    </p>
                  </div>
                </div>

                <span
                  className={`self-start sm:self-auto shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold border ${
                    telegram?.isActive
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                      : isTelegramConfigured
                      ? "bg-amber-950/80 text-amber-400 border-amber-800/60"
                      : "bg-zinc-800/60 text-zinc-400 border-zinc-700/60"
                  }`}
                >
                  {telegram?.isActive ? "Bağlı & Aktif" : isTelegramConfigured ? "Bağlı Değil" : "NOT_CONFIGURED"}
                </span>
              </div>

              {telegramMessage && (
                <div
                  className={`rounded-xl p-3 flex items-center gap-2 text-xs ${
                    telegramMessage.success
                      ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                      : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
                  }`}
                >
                  {telegramMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{telegramMessage.text}</span>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                {telegram?.isActive ? (
                  <>
                    <button
                      type="button"
                      onClick={handleTestTelegram}
                      className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      Test Bildirimi Gönder
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectTelegram}
                      className="rounded-lg border border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/50 px-3.5 py-2 text-xs font-semibold text-rose-400 transition-colors"
                    >
                      Bağlantıyı Kes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isLinkingTelegram || !isTelegramConfigured}
                    onClick={handleConnectTelegram}
                    className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLinkingTelegram ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Telegram&apos;ı Bağla</span>
                  </button>
                )}
              </div>
            </div>

            {/* Email Channel Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-white">E-posta Bildirimleri</h3>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Adres: {user.email} ({emailVerified ? "Doğrulanmış" : "Doğrulanmamış"})
                    </p>
                  </div>
                </div>

                <span
                  className={`self-start sm:self-auto shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold border ${
                    emailVerified
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                      : "bg-amber-950/80 text-amber-400 border-amber-800/60"
                  }`}
                >
                  {emailVerified ? "Doğrulandı" : "Doğrulama Gerekli"}
                </span>
              </div>

              {emailMessage && (
                <div
                  className={`rounded-xl p-3 flex items-center gap-2 text-xs ${
                    emailMessage.success
                      ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                      : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
                  }`}
                >
                  {emailMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{emailMessage.text}</span>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                {!emailVerified ? (
                  <button
                    type="button"
                    disabled={isSendingEmailVerification}
                    onClick={handleSendEmailVerification}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSendingEmailVerification ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>Doğrulama E-postası Gönder</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors"
                  >
                    Test E-postası Gönder
                  </button>
                )}
              </div>
            </div>

            {/* Other Channels (Truthful UI) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-950/20 opacity-60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-zinc-300">Discord Botu</span>
                  <span className="text-[10px] font-mono uppercase text-zinc-500">NOT_CONFIGURED</span>
                </div>
                <p className="text-[11px] text-zinc-500">Gelecek sürümlerde desteklenecektir.</p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-950/20 opacity-60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-zinc-300">Web Push</span>
                  <span className="text-[10px] font-mono uppercase text-zinc-500">NOT_CONFIGURED</span>
                </div>
                <p className="text-[11px] text-zinc-500">Tarayıcı anlık bildirimleri henüz aktif değil.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: QUIET HOURS */}
        {activeTab === "quiet" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Sessiz Saatler</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Belirttiğiniz saat aralığında Telegram ve E-posta bildirimleri bekletilir; uygulama içi bildirimler kesintisiz devam eder.
              </p>
            </div>

            {quietMessage && (
              <div
                className={`rounded-xl p-3.5 flex items-center gap-2.5 text-xs ${
                  quietMessage.success
                    ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                    : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
                }`}
              >
                {quietMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{quietMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuietHours} className="space-y-4 max-w-lg">
              <label className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quietHours.quietHoursEnabled}
                  onChange={(e) =>
                    setQuietHours((prev) => ({ ...prev, quietHoursEnabled: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Sessiz Saatleri Etkinleştir</span>
                  <span className="text-[11px] text-zinc-400">
                    Gece saatlerinde dış kanallardan bildirim gönderilmez.
                  </span>
                </div>
              </label>

              {quietHours.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Başlangıç Saati</label>
                    <input
                      type="time"
                      value={quietHours.quietHoursStart || "23:00"}
                      onChange={(e) =>
                        setQuietHours((prev) => ({ ...prev, quietHoursStart: e.target.value }))
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Bitiş Saati</label>
                    <input
                      type="time"
                      value={quietHours.quietHoursEnd || "08:00"}
                      onChange={(e) =>
                        setQuietHours((prev) => ({ ...prev, quietHoursEnd: e.target.value }))
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Zaman Dilimi</label>
                <input
                  type="text"
                  disabled
                  value={quietHours.timezone}
                  className="w-full rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Varsayılan: Europe/Istanbul</span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingQuiet}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  {isSavingQuiet ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Sessiz Saatleri Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 6: DEFAULTS & LOCALES */}
        {activeTab === "defaults" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Varsayılanlar ve Bölge</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Yeni alarmlar oluşturulurken kullanılacak varsayılan tercihler.</p>
            </div>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Varsayılan Alarm Tipi</label>
                <select
                  value={quietHours.defaultAlertType}
                  onChange={(e) =>
                    setQuietHours((prev) => ({
                      ...prev,
                      defaultAlertType: e.target.value as PriceAlertType,
                    }))
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={PriceAlertType.ANY_DISCOUNT}>Herhangi Bir İndirim (ANY_DISCOUNT)</option>
                  <option value={PriceAlertType.PRICE_BELOW}>Hedef Fiyat Altı (PRICE_BELOW)</option>
                  <option value={PriceAlertType.DISCOUNT_AT_LEAST}>Minimum İndirim Yüzdesi (DISCOUNT_AT_LEAST)</option>
                  <option value={PriceAlertType.OBSERVED_LOW}>Tarihi Dip Fiyat (OBSERVED_LOW)</option>
                  <option value={PriceAlertType.DEAL_SCORE_AT_LEAST}>Minimum Fırsat Skoru (DEAL_SCORE_AT_LEAST)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Dil</label>
                  <input
                    type="text"
                    disabled
                    value="Türkçe (tr-TR)"
                    className="w-full rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Para Birimi</label>
                  <input
                    type="text"
                    disabled
                    value="Türk Lirası (₺ TRY)"
                    className="w-full rounded-xl border border-zinc-800/60 bg-zinc-950/60 px-3.5 py-2.5 text-xs text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
