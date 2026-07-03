"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, User, Star } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import NotificationBell from "@/components/notifications/NotificationBell";
import AnnualPromoModal, { type AnnualPromoData } from "@/components/promo/AnnualPromoModal";
import type { Role } from "@/types";

export type NavItem = {
  label: string;
  href: string;
  icon: string | null;
  target: "_self" | "_blank";
  visible_to: "guest" | "student" | "admin";
};

interface StudentHeaderProps {
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  userId: string;
  initialNotifications: Array<{
    id: string; type: string; title: string;
    body: string | null; link: string | null;
    read: boolean; created_at: string;
  }>;
  initialUnread: number;
  navItems?: NavItem[];
  annualPromo?: AnnualPromoData | null;
}

export default function StudentHeader({
  fullName,
  role: _role,
  userId,
  initialNotifications,
  initialUnread,
  annualPromo,
}: StudentHeaderProps) {
  const pathname = usePathname();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const initial = fullName?.charAt(0)?.toUpperCase() || "A";

  useEffect(() => { setAvatarOpen(false); }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAvatarOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="brand-stripe"><span /><span /><span /></div>

      <div className="border-b border-border/60">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">

            {/* Logo */}
            <Link href="/cursos" className="flex items-center gap-2 shrink-0">
              <Image
                src="/logo-vertical-azul.png"
                alt="Handify™"
                width={28}
                height={28}
                unoptimized
                className="object-contain"
              />
              <span className="font-black text-base tracking-tight hidden sm:block" style={{ color: "#6699F3" }}>
                Handify<sup className="text-xs ml-px">™</sup>
              </span>
            </Link>

            <div className="flex-1" />

            {/* Plano Anual — desktop */}
            {annualPromo && (
              <button
                onClick={() => setPromoOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEC649]/15 text-[#c9930a] text-xs font-bold hover:bg-[#FEC649]/25 transition-colors shrink-0"
              >
                <Star className="w-3.5 h-3.5 fill-[#FEC649] text-[#FEC649]" />
                {annualPromo.badge_text}
              </button>
            )}

            {/* Sino + avatar */}
            <div className="flex items-center gap-1">
              <NotificationBell
                userId={userId}
                initialNotifications={initialNotifications}
                initialUnread={initialUnread}
              />

              {/* Avatar */}
              <div className="relative" ref={avatarRef}>
                <button
                  onClick={() => setAvatarOpen((v) => !v)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white hover:opacity-90 transition-opacity ml-1"
                  style={{ background: "#6699F3" }}
                  aria-label="Menu do usuário"
                  aria-expanded={avatarOpen}
                >
                  {initial}
                </button>

                {avatarOpen && (
                  <div className="absolute right-0 top-10 z-50 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-border shadow-xl py-1 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/40">
                      <p className="text-sm font-semibold truncate">{fullName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Área de membros</p>
                    </div>
                    <Link
                      href="/perfil"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Meu perfil
                    </Link>
                    <div className="border-t border-border/40 mt-1 pt-1">
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Sair
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Faixa promo — mobile */}
      {annualPromo && (
        <button
          onClick={() => setPromoOpen(true)}
          className="sm:hidden w-full flex items-center justify-center gap-2 min-h-[44px] bg-[#FEC649]/20 text-[#b07d00] text-xs font-bold border-b border-[#FEC649]/30 hover:bg-[#FEC649]/30 active:bg-[#FEC649]/40 transition-colors"
        >
          <Star className="w-3.5 h-3.5 fill-[#FEC649] text-[#FEC649]" />
          {annualPromo.badge_text}
          <span className="opacity-60">— toque para saber mais</span>
        </button>
      )}

    </header>

    {promoOpen && annualPromo && (
      <AnnualPromoModal promo={annualPromo} onClose={() => setPromoOpen(false)} />
    )}
    </>
  );
}
