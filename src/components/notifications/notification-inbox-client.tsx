"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Inbox, Clock, ChevronRight } from "lucide-react";
import { CatalogPagination } from "@/components/game/catalog-pagination";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  badges?: string[];
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationInboxClientProps {
  initialNotifications: NotificationItem[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  totalAll: number;
  initialUnreadCount: number;
  currentFilter: "all" | "unread";
  pageSize: number;
}

function resolveBadges(item: NotificationItem): string[] {
  if (item.badges && item.badges.length > 0) {
    return item.badges;
  }

  // Fallback heuristic for legacy notifications without explicit badges array
  const badges: string[] = [];
  const lowerTitle = (item.title || "").toLowerCase();
  const lowerMsg = (item.message || "").toLowerCase();

  if (lowerTitle.includes("tarihi dip") || lowerMsg.includes("tarihi dip")) {
    badges.push("🎯 Tarihi Dip");
  }
  if (lowerTitle.includes("mega") || lowerTitle.includes("%70") || lowerMsg.includes("%7") || lowerMsg.includes("%8") || lowerMsg.includes("%9")) {
    badges.push("💥 Mega İndirim");
  }
  if (lowerTitle.includes("fırsat skoru") || lowerMsg.includes("skor")) {
    badges.push("⚡ Yüksek Fırsat");
  }
  if (lowerTitle.includes("ücretsiz") || lowerMsg.includes("0 tl") || lowerMsg.includes("ücretsiz")) {
    badges.push("🎁 Ücretsiz");
  }
  if (lowerTitle.includes("istek") || lowerMsg.includes("istek list")) {
    badges.push("✨ İstek Listesi");
  }
  if (lowerTitle.includes("dlc") || lowerTitle.includes("eklenti") || lowerMsg.includes("eklenti")) {
    badges.push("📦 Eklenti");
  }
  if (lowerTitle.includes("favori")) {
    badges.push("❤️ Favori");
  }

  if (badges.length === 0 && item.title) {
    badges.push(item.title);
  }

  return Array.from(new Set(badges));
}

export function NotificationInboxClient({
  initialNotifications,
  currentPage,
  totalPages,
  totalItems,
  totalAll,
  initialUnreadCount,
  currentFilter,
  pageSize,
}: NotificationInboxClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
        );
        setUnreadCount(0);
        router.refresh();
      }
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // Ignore error
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/bildirimler?filter=all"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              currentFilter === "all"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tümü ({totalAll})
          </Link>
          <Link
            href="/bildirimler?filter=unread"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              currentFilter === "unread"
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Okunmamış ({unreadCount})
          </Link>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={isMarkingAll}
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50 self-start sm:self-auto"
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Tümünü Okundu İşaretle</span>
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Inbox className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">
            {currentFilter === "unread" ? "Okunmamış bildiriminiz yok" : "Henüz bildiriminiz yok"}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            İstek listenizdeki veya takip ettiğiniz oyunlarda indirim ve fırsat olduğunda burada görünecektir.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => {
            const isUnread = !item.readAt;
            const badges = resolveBadges(item);
            const dateStr = new Date(item.createdAt).toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-all ${
                  isUnread
                    ? "border-emerald-800/60 bg-emerald-950/20"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      isUnread ? "bg-emerald-400 shadow-sm shadow-emerald-500" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-tight">{item.title}</span>
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dateStr}
                      </span>
                    </div>

                    {/* Distinctive Group / Category Badges */}
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 my-1.5">
                        {badges.map((badge, bIdx) => {
                          const isDip = badge.includes("Dip");
                          const isMega = badge.includes("Mega") || badge.includes("İndirim");
                          const isScore = badge.includes("Skor");
                          const isFree = badge.includes("Ücretsiz");

                          let colorClass = "bg-zinc-800/90 border-zinc-700 text-zinc-300";
                          if (isDip) {
                            colorClass = "bg-amber-500/15 border-amber-500/30 text-amber-300";
                          } else if (isMega) {
                            colorClass = "bg-emerald-500/15 border-emerald-500/30 text-emerald-300";
                          } else if (isScore) {
                            colorClass = "bg-sky-500/15 border-sky-500/30 text-sky-300";
                          } else if (isFree) {
                            colorClass = "bg-purple-500/15 border-purple-500/30 text-purple-300";
                          }

                          return (
                            <span
                              key={bIdx}
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shadow-sm ${colorClass}`}
                            >
                              {badge}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-xs text-zinc-300 leading-relaxed">{item.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {item.linkUrl && (
                    <Link
                      href={item.linkUrl}
                      onClick={() => {
                        if (isUnread) handleMarkRead(item.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      <span>Oyunu Gör</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400 transition-all"
                      title="Okundu İşaretle"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pt-4 border-t border-zinc-800/80">
          <CatalogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            basePath="/bildirimler"
            searchParams={{ filter: currentFilter !== "all" ? currentFilter : undefined }}
          />
        </div>
      )}
    </div>
  );
}
