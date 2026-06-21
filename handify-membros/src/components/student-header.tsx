"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu, X, LogOut, User, ExternalLink,
  LayoutDashboard, BookOpen, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import GlobalSearch from "@/components/search/GlobalSearch";
import NotificationBell from "@/components/notifications/NotificationBell";
import AnnualPromoModal, { type AnnualPromoData } from "@/components/promo/AnnualPromoModal";
import type { Role } from "@/types";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map,
};

export type NavItem = {
  label: string;
  href: string;
  icon: string | null;
  target: "_self" | "_blank";
  visible_to: "guest" | "student" | "admin";
};

const FALLBACK_NAV: NavItem[] = [
  { label: "Minha Jornada", href: "/dashboard", icon: "LayoutDashboard", target: "_self", visible_to: "student" },
  { label: "Cursos", href: "/cursos", icon: "BookOpen", target: "_self", visible_to: "guest" },
  { label: "Perfil", href: "/perfil", icon: "User", target: "_self", visible_to: "student" },
];

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
  avatarUrl: _avatarUrl,
  role,
  userId,
  initialNotifications,
  initialUnread,
  navItems,
  annualPromo,
}: StudentHeaderProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const initial = fullName?.charAt(0)?.toUpperCase() || "A";
  const items = navItems && navItems.length > 0 ? navItems : FALLBACK_NAV;

  const visibleItems = items.filter((item) => {
    if (item.visible_to === "guest") return true;
    if (item.visible_to === "student") return true;
    if (item.visible_to === "admin") return role === "admin";
    return false;
  });

  // Fecha os painéis ao navegar
  useEffect(() => {
    setNavOpen(false);
    setAvatarOpen(false);
  }, [pathname]);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fecha com Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setNavOpen(false); setAvatarOpen(false); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border/60 shadow-sm">
      <div className="brand-stripe"><span /><span /><span /></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-3">

          {/* Hambúrguer */}
          <div className="relative" ref={navRef}>
            <button
              onClick={() => { setNavOpen((v) => !v); setAvatarOpen(false); }}
              aria-label={navOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={navOpen}
              className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Painel de navegação */}
            {navOpen && (
              <div className="absolute left-0 top-11 z-50 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-border shadow-xl py-2 overflow-hidden">
                <nav className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const Icon = item.icon ? ICON_MAP[item.icon] : null;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const isAdmin = item.visible_to === "admin";

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={item.target}
                        rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                        onClick={() => setNavOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isAdmin
                            ? "text-[#FEC649] hover:bg-[#FEC649]/10"
                            : isActive
                            ? "text-[#6699F3] bg-[#6699F3]/10"
                            : "text-foreground/75 hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {Icon
                          ? <Icon className="w-4 h-4 shrink-0" />
                          : <span className="w-4 h-4 shrink-0" />
                        }
                        <span className="flex-1">{item.label}</span>
                        {item.target === "_blank" && (
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-40" />
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Plano Anual — mobile (dentro do nav drawer) */}
                {annualPromo && (
                  <div className="px-2 pb-2 mt-1 border-t border-border/40 pt-2">
                    <button
                      onClick={() => { setNavOpen(false); setPromoOpen(true); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg bg-[#FEC649]/15 text-xs font-bold text-[#c9930a] hover:bg-[#FEC649]/25 transition-colors"
                    >
                      <Star className="w-4 h-4 fill-[#FEC649] text-[#FEC649] shrink-0" />
                      {annualPromo.badge_text}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Botão Plano Anual (quando ativo) */}
          {annualPromo && (
            <button
              onClick={() => setPromoOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEC649]/15 text-[#c9930a] text-xs font-bold hover:bg-[#FEC649]/25 transition-colors shrink-0"
            >
              <Star className="w-3.5 h-3.5 fill-[#FEC649] text-[#FEC649]" />
              {annualPromo.badge_text}
            </button>
          )}

          {/* Right: busca + sino + avatar */}
          <div className="flex items-center gap-1">
            <GlobalSearch />

            <NotificationBell
              userId={userId}
              initialNotifications={initialNotifications}
              initialUnread={initialUnread}
            />

            {/* Avatar com dropdown */}
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => { setAvatarOpen((v) => !v); setNavOpen(false); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white hover:opacity-90 transition-opacity ml-1"
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

      {promoOpen && annualPromo && (
        <AnnualPromoModal promo={annualPromo} onClose={() => setPromoOpen(false)} />
      )}
    </header>
  );
}
