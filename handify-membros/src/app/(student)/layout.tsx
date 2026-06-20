import type { ReactNode } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudentHeader from "@/components/student-header";
import CatalogHeader from "@/components/catalog-header";
import { getUnreadCount, getNotifications } from "@/lib/notifications/actions";
import type { Role } from "@/types";
import type { NavItem } from "@/components/student-header";

// Rotas dentro de (student) acessíveis sem login
const PUBLIC_PATHS = ["/cursos"];

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) redirect("/login");

  const [{ data: profile }, initialNotifications, unreadCount, { data: menuItemsRaw }] =
    await Promise.all([
      user
        ? supabase.from("profiles").select("full_name, avatar_url, role").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      user ? getNotifications(user.id, 30) : Promise.resolve([]),
      user ? getUnreadCount(user.id) : Promise.resolve(0),
      supabase
        .from("menu_items")
        .select("label, url, icon, target, visible_to, position")
        .eq("active", true)
        .order("position", { ascending: true }),
    ]);

  const navItems: NavItem[] = (menuItemsRaw ?? []).map((i) => ({
    label: i.label,
    href: i.url,
    icon: i.icon ?? null,
    target: (i.target as "_self" | "_blank") ?? "_self",
    visible_to: i.visible_to as "guest" | "student" | "admin",
  }));

  // Layout unificado — mesma estrutura HTML independente da rota.
  // Rotas públicas (/cursos) usam CatalogHeader quando não autenticadas.
  // Cada page gerencia sua própria centralização para evitar cache parcial do RSC.
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F0] w-full">
      {user ? (
        <StudentHeader
          fullName={profile?.full_name ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          role={(profile?.role ?? "student") as Role}
          userId={user.id}
          initialNotifications={initialNotifications}
          initialUnread={unreadCount}
          navItems={navItems}
        />
      ) : (
        <CatalogHeader isLoggedIn={false} />
      )}
      <main className="flex-1 w-full">{children}</main>
      <footer className="py-3 text-center text-xs text-muted-foreground border-t border-border/30 bg-white">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
