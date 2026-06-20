"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu, X,
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
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

// Fallback used when menu_items table is empty (before migration)
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
  const [open, setOpen] = useState(false);

  const initial = fullName?.charAt(0)?.toUpperCase() || "A";

  const items = navItems && navItems.length > 0 ? navItems : FALLBACK_NAV;

  // Filter items by visibility for the current user
  const visibleItems = items.filter((item) => {
    if (item.visible_to === "guest") return true;
    if (item.visible_to === "student") return true; // layout only renders StudentHeader when logged in
    if (item.visible_to === "admin") return role === "admin";
    return false;
  });

  function NavLink({ item, block = false }: { item: NavItem; block?: boolean }) {
    const Icon = item.icon ? ICON_MAP[item.icon] : null;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const isAdmin = item.visible_to === "admin";

    return (
      <Link
        href={item.href}
        target={item.target}
        rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
        onClick={() => block && setOpen(false)}
        className={cn(
          block ? "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors" : "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          isAdmin
            ? "text-[#FEC649] hover:bg-[#FEC649]/10"
            : isActive
            ? "text-[#6699F3] bg-[#6699F3]/10"
            : "text-foreground/70 hover:text-foreground hover:bg-muted"
        )}
      >
        {Icon && <Icon className="w-4 h-4 shrink-0" />}
        {item.label}
      </Link>
    );
  }

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
            {visibleItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            <GlobalSearch />

            <NotificationBell
              userId={userId}
              initialNotifications={initialNotifications}
              initialUnread={initialUnread}
            />

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
            {visibleItems.map((item) => (
              <NavLink key={item.href} item={item} block />
            ))}
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
