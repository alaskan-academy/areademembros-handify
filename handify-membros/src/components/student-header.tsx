"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types";

const NAV_ITEMS = [
  { label: "Minha Jornada", href: "/dashboard" },
  { label: "Cursos", href: "/cursos" },
  { label: "Perfil", href: "/perfil" },
];

interface StudentHeaderProps {
  fullName: string;
  avatarUrl: string | null;
  role: Role;
}

export default function StudentHeader({
  fullName,
  avatarUrl: _avatarUrl,
  role,
}: StudentHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const initial = fullName?.charAt(0)?.toUpperCase() || "A";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border/60 shadow-sm">
      <div className="brand-stripe">
        <span />
        <span />
        <span />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo-vertical-azul.png"
              alt="Handify™"
              width={28}
              height={28}
              unoptimized
              className="object-contain"
            />
            <span
              className="font-black text-base tracking-tight hidden sm:block"
              style={{ color: "#6699F3" }}
            >
              Handify<sup className="text-xs ml-px">™</sup>
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "text-[#6699F3] bg-[#6699F3]/10"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
            {role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-[#FEC649] hover:bg-[#FEC649]/10 transition-colors"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Notificações"
              className="p-2 rounded-md text-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
            >
              <Bell className="w-5 h-5" />
            </button>

            <div className="hidden md:flex items-center gap-2 ml-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: "#6699F3" }}
                aria-hidden
              >
                {initial}
              </div>
              <span className="text-sm font-medium max-w-[120px] truncate text-foreground/80">
                {fullName}
              </span>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit" className="text-sm text-foreground/60">
                  Sair
                </Button>
              </form>
            </div>

            {/* Hamburger mobile */}
            <button
              className="md:hidden p-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden py-3 border-t border-border/40 space-y-1 pb-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "text-[#6699F3] bg-[#6699F3]/10"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
            {role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-[#FEC649] hover:bg-[#FEC649]/10"
              >
                Admin
              </Link>
            )}
            <div className="pt-3 border-t border-border/40 flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "#6699F3" }}
                >
                  {initial}
                </div>
                <span className="text-sm text-foreground/70 truncate max-w-[160px]">
                  {fullName}
                </span>
              </div>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit" className="text-sm">
                  Sair
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
