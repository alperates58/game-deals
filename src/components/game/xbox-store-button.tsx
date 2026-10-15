"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Smartphone, Monitor } from "lucide-react";

interface XboxStoreActionsProps {
  storeUrl: string;
  xboxProductId: string;
  gameTitle: string;
}

export function XboxStoreActions({
  storeUrl,
  xboxProductId,
  gameTitle,
}: XboxStoreActionsProps) {
  const [platform, setPlatform] = useState<"ios" | "android" | "windows" | "other">("other");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform("ios");
    } else if (/Android/.test(ua)) {
      setPlatform("android");
    } else if (/Windows/.test(ua)) {
      setPlatform("windows");
    }
  }, []);

  const handleAppLaunch = (e: React.MouseEvent) => {
    e.preventDefault();

    if (platform === "windows" && xboxProductId) {
      // Windows Microsoft Store / Xbox PC protocol
      window.location.href = `ms-windows-store://pdp/?ProductId=${xboxProductId.toLowerCase()}`;
    } else if (platform === "ios" || platform === "android") {
      // On iOS and Android, Apple Universal Links & Android App Links
      // require top-level navigation without target="_blank" to trigger the installed native Xbox app.
      window.location.href = storeUrl;
    } else {
      // Desktop Mac/Linux fallback: open in new tab
      window.open(storeUrl, "_blank", "noopener,noreferrer");
    }
  };

  const appButtonLabel =
    platform === "ios"
      ? "Xbox iOS Uygulamasında Aç"
      : platform === "android"
      ? "Xbox Uygulamasında Aç"
      : platform === "windows"
      ? "Windows Store'da Aç"
      : "Xbox Uygulamasında Aç";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* 1. Primary Action: Always opens store in a NEW TAB */}
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>Xbox Mağazasında Aç</span>
          <ExternalLink className="h-4 w-4" />
        </a>

        {/* 2. Companion Native App Launcher: triggers iOS Universal Link, Android App Link, or Windows Protocol */}
        <button
          type="button"
          onClick={handleAppLaunch}
          title={`${gameTitle} için ${appButtonLabel}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-emerald-500/50 hover:bg-zinc-700/80 hover:text-white transition-all active:scale-[0.98]"
        >
          {platform === "windows" ? (
            <Monitor className="h-4 w-4 text-emerald-400" />
          ) : (
            <Smartphone className="h-4 w-4 text-emerald-400" />
          )}
          <span>{isClient ? appButtonLabel : "Xbox Uygulamasında Aç"}</span>
        </button>
      </div>

      {/* Helpful Hint */}
      <span className="text-[11px] text-zinc-400">
        💡 Cihazınızda Xbox uygulaması yüklüyse <strong className="text-zinc-300 font-medium">Uygulamada Aç</strong> doğrudan uygulamayı başlatır. Web sayfası yeni sekmede açılır.
      </span>
    </div>
  );
}
