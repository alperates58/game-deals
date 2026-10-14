import { DealVerdict, ConfidenceLevel } from "@prisma/client";

interface DealBadgeProps {
  verdict: DealVerdict;
  dealScore?: number;
  size?: "sm" | "md" | "lg";
}

export function DealBadge({ verdict, dealScore, size = "md" }: DealBadgeProps) {
  const verdictConfig = {
    EXCELLENT: {
      label: "Kaçırma",
      emoji: "🔥",
      className: "bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950",
    },
    VERY_GOOD: {
      label: "Çok İyi",
      emoji: "🟢",
      className: "bg-emerald-950/60 text-emerald-400 border-emerald-600/40",
    },
    GOOD: {
      label: "İyi Fırsat",
      emoji: "🟡",
      className: "bg-amber-950/60 text-amber-300 border-amber-600/40",
    },
    WAIT: {
      label: "Bekle",
      emoji: "🟠",
      className: "bg-orange-950/50 text-orange-300 border-orange-700/40",
    },
    POOR: {
      label: "Zayıf Fırsat",
      emoji: "🔴",
      className: "bg-rose-950/50 text-rose-300 border-rose-800/40",
    },
  }[verdict] || {
    label: "Normal",
    emoji: "⚪",
    className: "bg-zinc-800 text-zinc-300 border-zinc-700",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm font-semibold",
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight ${sizeClasses} ${verdictConfig.className}`}
    >
      <span>{verdictConfig.emoji}</span>
      <span>{verdictConfig.label}</span>
      {dealScore !== undefined && (
        <span className="opacity-75 font-mono text-[10px]">({dealScore})</span>
      )}
    </span>
  );
}

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const config = {
    LOW: { label: "Yeni Takip", className: "bg-zinc-800/80 text-zinc-400 border-zinc-700" },
    MEDIUM: { label: "Orta Güven", className: "bg-blue-950/60 text-blue-300 border-blue-800/40" },
    HIGH: { label: "Yüksek Güven", className: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40" },
    VERY_HIGH: { label: "Çok Yüksek Güven", className: "bg-purple-950/60 text-purple-300 border-purple-800/40" },
  }[confidence] || { label: "Bilinmiyor", className: "bg-zinc-800 text-zinc-400 border-zinc-700" };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium border ${config.className}`}
      title="Fiyat geçmişi veri kalitesi"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {config.label}
    </span>
  );
}
