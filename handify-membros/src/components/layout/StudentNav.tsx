"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, MessageSquare, User,
  Menu as MenuIcon, X, LogOut, ExternalLink,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Home, Bell, Users, ShoppingBag, Star, Heart, Globe, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map, Sparkles, Wrench, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import type { NavItem } from "@/components/layout/StudentHeader";
import type { Role } from "@/types";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map,
};

// Atalhos fixos do bottom tab mobile
const BOTTOM_TABS = [
  { href: "/cursos",          icon: BookOpen,   label: "Cursos" },
  { href: "/inspiracoes",     icon: Sparkles,   label: "Inspirações" },
  { href: "/comunidade/feed", icon: Bell,       label: "Avisos" },
  { href: "/ferramentas",     icon: Wrench,     label: "Ferramentas" },
];

interface StudentNavProps {
  navItems: NavItem[];
  role: Role;
  fullName: string;
}

export default function StudentNav({ navItems, role, fullName }: StudentNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const markDrawerNavigating = useModalBackGuard(drawerOpen, () => setDrawerOpen(false));

  const visibleItems = navItems.filter((item) => {
    if (item.visible_to === "guest") return true;
    if (item.visible_to === "student") return true;
    if (item.visible_to === "admin") return role === "admin";
    return false;
  });

  // Restaura preferência salva
  useEffect(() => {
    const stored = localStorage.getItem("student-sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("student-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────── */}

      {/* Espaçador: mantém o flex layout (empurra o <main>) sem bloquear sticky */}
      <div
        aria-hidden
        className={cn(
          "hidden md:block shrink-0 transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      />

      {/* Sidebar fixo — nunca rola com a página */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 bg-white border-r border-border/60 z-30",
          "fixed top-[61px] left-0 h-[calc(100vh-61px)] overflow-hidden",
          "transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <nav className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-2 px-2">
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
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors mb-0.5",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  isAdmin
                    ? "text-[#c9930a] hover:bg-[#FEC649]/10"
                    : isActive
                    ? "text-[#6699F3] bg-[#6699F3]/10"
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                {Icon
                  ? <Icon className="w-4 h-4 shrink-0" />
                  : <span className="w-4 h-4 shrink-0 rounded bg-muted" />
                }
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.target === "_blank" && (
                      <ExternalLink className="w-3 h-3 opacity-40 shrink-0" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Botão toggle */}
        <div className="shrink-0 border-t border-border/60 p-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "flex items-center rounded-lg text-xs text-foreground/40 hover:text-foreground hover:bg-muted transition-colors w-full",
              collapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ──────────────────────── */}
      <nav
        className="md:hidden landscape:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border/60 flex items-stretch"
        aria-label="Navegação rápida"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {BOTTOM_TABS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors min-h-[52px]",
                isActive ? "text-[#6699F3]" : "text-foreground/45 hover:text-foreground/70"
              )}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.2 : 1.6}
              />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-foreground/45 hover:text-foreground/70 transition-colors min-h-[52px]"
          aria-label="Ver mais opções"
        >
          <MenuIcon className="w-5 h-5" strokeWidth={1.6} />
          Menu
        </button>
      </nav>

      {/* ── Mobile drawer ──────────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] bg-white shadow-2xl flex flex-col">
            <div className="brand-stripe"><span /><span /><span /></div>
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/60 shrink-0">
              <div>
                <p className="text-sm font-bold text-foreground">{fullName || "Olá!"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Área de membros</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-2 px-2">
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
                    onClick={() => { markDrawerNavigating(); setDrawerOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5",
                      isAdmin
                        ? "text-[#c9930a] hover:bg-[#FEC649]/10"
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

            <div className="shrink-0 border-t border-border/40 p-3">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
