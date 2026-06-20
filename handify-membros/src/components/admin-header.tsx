"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X, Settings, BookOpen, Users, BarChart3,
  ShoppingBag, Image, Bell, ChevronRight, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/admin/cursos",       icon: BookOpen,    label: "Cursos" },
  { href: "/admin/vitrine",      icon: ShoppingBag, label: "Vitrine" },
  { href: "/admin/alunos",       icon: Users,       label: "Alunas" },
  { href: "/admin/banners",      icon: Image,       label: "Banners" },
  { href: "/admin/metricas",     icon: BarChart3,   label: "Métricas" },
  { href: "/admin/notificacoes", icon: Bell,        label: "Notificações" },
  { href: "/admin/menu",         icon: Menu,        label: "Menu" },
];

export default function AdminHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const active = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  );

  return (
    <header className="bg-[#0F0F0F] text-white sticky top-0 z-40">
      <div className="brand-stripe"><span /><span /><span /></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-13 py-3 gap-3">

          {/* Hambúrguer */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fechar menu" : "Abrir menu admin"}
              aria-expanded={open}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {open && (
              <div className="absolute left-0 top-11 z-50 w-56 bg-[#1A1A1A] rounded-xl border border-white/10 shadow-2xl py-2 overflow-hidden">
                <p className="px-4 py-2 text-xs font-semibold text-white/30 uppercase tracking-widest">
                  Painel admin
                </p>
                <nav className="space-y-0.5 px-2">
                  {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "text-[#6699F3] bg-[#6699F3]/15"
                            : "text-white/70 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>

          {/* Logo + seção ativa */}
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="w-4 h-4 text-[#6699F3] shrink-0" />
            <span className="font-bold text-sm whitespace-nowrap">Handify Admin</span>
            {active && (
              <>
                <span className="text-white/30 text-sm">/</span>
                <span className="text-sm text-white/60 truncate">{active.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Link área de alunos */}
          <Link
            href="/dashboard"
            className="text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            Área de alunos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}
