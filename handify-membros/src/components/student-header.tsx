"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu, X, LogOut, ExternalLink,
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import GlobalSearch from "@/components/search/GlobalSearch";
import NotificationBell from "@/components/notifications/NotificationBell";
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
}

export default function StudentHeader({
  fullName,
  avatarUrl: _avatarUrl,
  role,
  userId,
  initialNotifications,
  initialUnread,
  navItems,
}: StudentHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const initial = fullName?.charAt(0)?.toUpperCase() || "A";
  const items = navItems && navItems.length > 0 ? navItems : FALLBACK_NAV;

  const visibleItems = items.filter((item) => {
    if (item.visible_to === "guest") return true;
    if (item.visible_to === "student") return true;
    if (item.visible_to === "admin") return role === "admin";
    return false;
  });

  function NavLink({ item, mobile = false }: { item: NavItem; mobile?: boolean }) {
    const Icon = item.icon ? ICON_MAP[item.icon] : null;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const isAdmin = item.visible_to === "admin";

    return (
      <Link
        href={item.href}
        target={item.target}
        rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
        onClick={() => mobile && setMobileOpen(false)}
        title={item.label}
        className={cn(
          "flex items-center gap-2 rounded-md font-medium transition-colors whitespace-nowrap",
          mobile
            ? "px-3 py-2.5 text-sm w-full"
            : "px-2.5 py-1.5 text-sm",
          isAdmin
            ? "text-[#FEC649] hover:bg-[#FEC649]/10"
            : isActive
            ? "text-[#6699F3] bg-[#6699F3]/10"
            : "text-foreground/70 hover:text-foreground hover:bg-muted"
        )}
      >
        {Icon && <Icon className="w-4 h-4 shrink-0" />}
        {/* Desktop: label visível só em lg+; mobile: sempre visível */}
        <span className={mobile ? undefined : "hidden lg:inline"}>
          {item.label}
        </span>
        {item.target === "_blank" && !mobile && (
          <ExternalLink className="w-3 h-3 shrink-0 opacity-40 hidden lg:inline" />
        )}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border/60 shadow-sm">
      <div className="brand-stripe"><span /><span /><span /></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-2">

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
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

          {/* Nav desktop — ícones em md, ícone+texto em lg */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
            {visibleItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1 ml-auto">
            <GlobalSearch />

            <NotificationBell
              userId={userId}
              initialNotifications={initialNotifications}
              initialUnread={initialUnread}
            />

            {/* Avatar com dropdown — desktop */}
            <div className="hidden md:block relative">
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 hover:opacity-90 transition-opacity"
                style={{ background: "#6699F3" }}
                aria-label="Menu do usuário"
                aria-expanded={avatarOpen}
              >
                {initial}
              </button>

              {avatarOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAvatarOpen(false)} />
                  <div className="absolute right-0 top-10 z-50 w-52 bg-white rounded-xl border border-border shadow-lg py-1 overflow-hidden">
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
                </>
              )}
            </div>

            {/* Hamburger mobile */}
            <button
              className="md:hidden p-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/40 pb-4">
            <nav className="pt-2 space-y-0.5">
              {visibleItems.map((item) => (
                <NavLink key={item.href} item={item} mobile />
              ))}
            </nav>
            <div className="mt-3 pt-3 border-t border-border/40 px-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: "#6699F3" }}
                >
                  {initial}
                </div>
                <span className="text-sm font-medium text-foreground/80 truncate">{fullName}</span>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors px-2 py-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
