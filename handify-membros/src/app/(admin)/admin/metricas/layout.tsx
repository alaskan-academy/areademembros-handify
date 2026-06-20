"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Video, Trophy, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/metricas", label: "Visão Geral", icon: BarChart2, exact: true },
  { href: "/admin/metricas/videos", label: "Vídeos", icon: Video, exact: false },
  { href: "/admin/metricas/alunas", label: "Ranking de Alunas", icon: Trophy, exact: false },
  { href: "/admin/metricas/funil", label: "Funil & Segmentos", icon: TrendingDown, exact: false },
];

export default function MetricasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Métricas & BI</h1>
        <p className="text-sm text-muted-foreground mt-1">Inteligência de negócio da plataforma</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  active
                    ? "border-[#6699F3] text-[#6699F3]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
