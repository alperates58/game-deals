"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, ExternalLink, Inbox, Clock, ChevronRight } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationInboxClientProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

export function NotificationInboxClient({
  initialNotifications,
  initialUnreadCount,
}: NotificationInboxClientProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
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

  const filtered = notifications.filter((n) => {
    if (filter === "UNREAD") return !n.readAt;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === "ALL"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tümü ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("UNREAD")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === "UNREAD"
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Okunmamış ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={isMarkingAll}
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Tümünü Okundu İşaretle</span>
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Inbox className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">Henüz bildiriminiz yok</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            İstek listenizdeki veya takip ettiğiniz oyunlarda indirim ve fırsat olduğunda burada görünecektir.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const isUnread = !item.readAt;
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
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      isUnread ? "bg-emerald-400 shadow-sm shadow-emerald-500" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-tight">{item.title}</span>
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dateStr}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{item.message}</p>
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
    </div>
  );
}
