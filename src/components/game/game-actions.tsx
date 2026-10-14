"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Heart,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Bell,
  Loader2,
} from "lucide-react";
import { PriceAlertDialog } from "./price-alert-dialog";
import { PriceAlertType } from "@prisma/client";

interface GameActionsProps {
  gameId: string;
  gameTitle: string;
  currentPrice: number;
  initialUserGame?: {
    owned?: boolean;
    favorite?: boolean;
    wishlist?: boolean;
    liked?: boolean;
    disliked?: boolean;
    completed?: boolean;
  } | null;
  initialAlert?: {
    type: PriceAlertType;
    isEnabled: boolean;
    targetPrice?: number | null;
    targetDiscount?: number | null;
    targetDealScore?: number | null;
  } | null;
  size?: "sm" | "md";
}

export function GameActions({
  gameId,
  gameTitle,
  currentPrice,
  initialUserGame,
  initialAlert,
  size = "md",
}: GameActionsProps) {
  const router = useRouter();
  const [userGame, setUserGame] = useState(
    initialUserGame || {
      owned: false,
      favorite: false,
      wishlist: false,
      liked: false,
      disliked: false,
      completed: false,
    }
  );
  const [hasAlert, setHasAlert] = useState(Boolean(initialAlert?.isEnabled));
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleToggle = async (action: string) => {
    setLoadingAction(action);

    // Optimistic calculation
    const previousState = { ...userGame };
    const nextState = { ...userGame };

    if (action === "toggle_owned") nextState.owned = !userGame.owned;
    if (action === "toggle_favorite") nextState.favorite = !userGame.favorite;
    if (action === "toggle_wishlist") nextState.wishlist = !userGame.wishlist;
    if (action === "toggle_liked") {
      const nextLiked = !userGame.liked;
      nextState.liked = nextLiked;
      if (nextLiked) nextState.disliked = false;
    }
    if (action === "toggle_disliked") {
      const nextDisliked = !userGame.disliked;
      nextState.disliked = nextDisliked;
      if (nextDisliked) nextState.liked = false;
    }

    setUserGame(nextState);

    try {
      const res = await fetch("/api/user-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action }),
      });

      const data = await res.json();

      if (res.status === 401 && data.requireLogin) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        // Rollback on failure
        setUserGame(previousState);
      } else if (data.userGame) {
        setUserGame(data.userGame);
      }
    } catch {
      setUserGame(previousState);
    } finally {
      setLoadingAction(null);
    }
  };

  const isSm = size === "sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {/* Owned Button */}
      <button
        onClick={() => handleToggle("toggle_owned")}
        disabled={loadingAction === "toggle_owned"}
        title={userGame.owned ? "Kütüphanenden Çıkar" : "Kütüphanemde Var Olarak İşaretle"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
          userGame.owned
            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-sm"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
        }`}
      >
        {loadingAction === "toggle_owned" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className={`h-3.5 w-3.5 ${userGame.owned ? "text-emerald-400 font-bold" : ""}`} />
        )}
        {!isSm && <span>{userGame.owned ? "Bende Var" : "Bende Var"}</span>}
      </button>

      {/* Favorite Button */}
      <button
        onClick={() => handleToggle("toggle_favorite")}
        disabled={loadingAction === "toggle_favorite"}
        title={userGame.favorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
          userGame.favorite
            ? "border-rose-500/40 bg-rose-500/20 text-rose-300 shadow-sm"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
        }`}
      >
        {loadingAction === "toggle_favorite" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Heart className={`h-3.5 w-3.5 ${userGame.favorite ? "fill-rose-500 text-rose-500" : ""}`} />
        )}
        {!isSm && <span>{userGame.favorite ? "Favoride" : "Favorile"}</span>}
      </button>

      {/* Wishlist Button */}
      <button
        onClick={() => handleToggle("toggle_wishlist")}
        disabled={loadingAction === "toggle_wishlist"}
        title={userGame.wishlist ? "İstek Listesinden Çıkar" : "İstek Listesine Ekle"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
          userGame.wishlist
            ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300 shadow-sm"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
        }`}
      >
        {loadingAction === "toggle_wishlist" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bookmark className={`h-3.5 w-3.5 ${userGame.wishlist ? "fill-indigo-500 text-indigo-500" : ""}`} />
        )}
        {!isSm && <span>{userGame.wishlist ? "İstek Listemde" : "İstek Listesi"}</span>}
      </button>

      {/* Like Button */}
      <button
        onClick={() => handleToggle("toggle_liked")}
        disabled={loadingAction === "toggle_liked"}
        title="Beğendim"
        className={`inline-flex items-center gap-1 rounded-lg border p-1.5 text-xs transition-all ${
          userGame.liked
            ? "border-sky-500/40 bg-sky-500/20 text-sky-400 shadow-sm"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
        }`}
      >
        {loadingAction === "toggle_liked" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ThumbsUp className={`h-3.5 w-3.5 ${userGame.liked ? "fill-sky-500 text-sky-500" : ""}`} />
        )}
      </button>

      {/* Dislike Button */}
      <button
        onClick={() => handleToggle("toggle_disliked")}
        disabled={loadingAction === "toggle_disliked"}
        title="Bana Göre Değil"
        className={`inline-flex items-center gap-1 rounded-lg border p-1.5 text-xs transition-all ${
          userGame.disliked
            ? "border-amber-500/40 bg-amber-500/20 text-amber-400 shadow-sm"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
        }`}
      >
        {loadingAction === "toggle_disliked" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ThumbsDown className={`h-3.5 w-3.5 ${userGame.disliked ? "fill-amber-500 text-amber-500" : ""}`} />
        )}
      </button>

      {/* Price Alert Dialog Button */}
      <button
        onClick={() => setIsAlertOpen(true)}
        title={hasAlert ? "Alarm Aktif" : "Fiyat Alarmı Kur"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
          hasAlert
            ? "border-amber-500/40 bg-amber-500/20 text-amber-300 shadow-sm"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
        }`}
      >
        <Bell className={`h-3.5 w-3.5 ${hasAlert ? "fill-amber-400 text-amber-400" : ""}`} />
        {!isSm && <span>{hasAlert ? "Alarm Kurulu" : "Alarm Kur"}</span>}
      </button>

      <PriceAlertDialog
        gameId={gameId}
        gameTitle={gameTitle}
        currentPrice={currentPrice}
        existingAlert={initialAlert}
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        onSaved={() => setHasAlert(true)}
      />
    </div>
  );
}
