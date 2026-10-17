"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Role } from "@prisma/client";

interface MobileNavProps {
  user: {
    userId: string;
    email: string;
    role: Role;
    name: string;
  } | null;
}

export function MobileNav({ user }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex xl:hidden items-center justify-center h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shrink-0"
        aria-label="Menüyü Aç"
        title="Menüyü Aç"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sidebar user={user} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
