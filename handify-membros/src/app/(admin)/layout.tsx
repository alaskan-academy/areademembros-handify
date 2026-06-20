import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, BookOpen, Users, BarChart3, ChevronRight, ShoppingBag, Image } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header admin */}
      <header className="bg-[#0F0F0F] text-white">
        <div className="brand-stripe"><span /><span /><span /></div>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 text-[#6699F3]" />
            <span className="font-bold text-sm">Handify Admin</span>
          </div>
          <Link href="/dashboard" className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1">
            Área de alunos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-3 flex gap-6">
          {[
            { href: "/admin/cursos", icon: BookOpen, label: "Cursos" },
            { href: "/admin/vitrine", icon: ShoppingBag, label: "Vitrine" },
            { href: "/admin/alunos", icon: Users, label: "Alunas" },
            { href: "/admin/banners", icon: Image, label: "Banners" },
            { href: "/admin/metricas", icon: BarChart3, label: "Métricas" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
