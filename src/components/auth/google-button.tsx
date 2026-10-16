import React from "react";

export function GoogleIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.27 21.43 7.35 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32 0-.83.13-1.6.38-2.32V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.58l4.03 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
      />
    </svg>
  );
}

interface GoogleButtonProps {
  configured?: boolean;
  label?: string;
  returnTo?: string;
}

export function GoogleButton({
  configured = true,
  label = "Google ile Devam Et",
  returnTo = "/profil",
}: GoogleButtonProps) {
  if (!configured) {
    return null;
  }

  const href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <a
      href={href}
      className="w-full flex items-center justify-center gap-3 rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-4 py-2.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700/90 hover:text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      <GoogleIcon />
      <span>{label}</span>
    </a>
  );
}
