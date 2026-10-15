import Link from "next/link";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export function BrandLogo({
  size = "md",
  showTagline = false,
  className = "",
  onClick,
}: BrandLogoProps) {
  const iconSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const titleSize =
    size === "sm"
      ? "text-sm sm:text-base"
      : size === "lg"
      ? "text-xl sm:text-2xl"
      : "text-base sm:text-lg";

  return (
    <Link
      href="/"
      onClick={onClick}
      className={`group flex items-center gap-2.5 sm:gap-3 transition-all select-none shrink-0 ${className}`}
    >
      {/* Xbox Sphere Glow Emblem */}
      <div
        className={`relative ${iconSize} flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-zinc-950 p-[1px] shadow-lg shadow-emerald-950/60 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-emerald-900/80 shrink-0`}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-zinc-950/90 backdrop-blur-sm">
          {/* Authentic Xbox Vector Glyph */}
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)] transition-all group-hover:text-emerald-300"
            fill="currentColor"
          >
            {/* Xbox Classic 'X' Sphere Symbol */}
            <path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10zm0 1.5c1.94 0 3.73.63 5.18 1.7-1.35 1.54-3.5 3.7-5.18 5.4-1.68-1.7-3.83-3.86-5.18-5.4A8.47 8.47 0 0 1 12 3.5zm-6.62 2.94c1.23 1.45 3.32 3.54 4.88 5.12-1.92 2.05-4.8 5.25-6.23 6.94A8.47 8.47 0 0 1 3.5 12c0-2.14.79-4.09 2.08-5.56h-.2zM12 20.5a8.47 8.47 0 0 1-5.18-1.7c1.35-1.54 3.5-3.7 5.18-5.4 1.68 1.7 3.83 3.86 5.18 5.4a8.47 8.47 0 0 1-5.18 1.7zm6.62-2.94c-1.23-1.45-3.32-3.54-4.88-5.12 1.92-2.05 4.8-5.25 6.23-6.94A8.47 8.47 0 0 1 20.5 12c0 2.14-.79 4.09-2.08 5.56h.2z" />
          </svg>
        </div>

        {/* Ambient Ring Glow */}
        <div className="absolute -inset-0.5 rounded-xl bg-emerald-500/20 blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Typography with High-End Styling */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`${titleSize} font-black tracking-tight text-white transition-colors`}>
            XBOX
          </span>
          <span
            className={`${titleSize} font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent`}
          >
            FIRSAT
          </span>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-950/70 px-1.5 py-0.2 text-[9px] font-mono font-bold tracking-wider text-emerald-400 shadow-sm">
            TR
          </span>
        </div>

        {showTagline && (
          <span className="text-[10px] font-medium tracking-wide text-zinc-500 group-hover:text-zinc-400 transition-colors">
            Gerçek İndirim ve Fiyat Takip Radarı
          </span>
        )}
      </div>
    </Link>
  );
}
