import type { ReactNode } from "react";
import { headers } from "next/headers";
import UpdatePrompt from "@/components/pwa/UpdatePrompt";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import PushPromptBanner from "@/components/pwa/PushPromptBanner";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudentHeader from "@/components/student-header";
import StudentNav from "@/components/student-nav";
import CatalogHeader from "@/components/catalog-header";
import TermsAcceptanceBanner from "@/components/TermsAcceptanceBanner";
import ScrollToTop from "@/components/ScrollToTop";
import { getUnreadCount, getNotifications } from "@/lib/notifications/actions";
import type { Role } from "@/types";
import type { NavItem } from "@/components/student-header";
import type { AnnualPromoData } from "@/components/promo/AnnualPromoModal";

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

  const [{ data: profile }, initialNotifications, unreadCount, { data: menuItemsRaw }, { data: promoRaw }] =
    await Promise.all([
      user
        ? supabase.from("profiles").select("full_name, avatar_url, role, terms_accepted_at").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      user ? getNotifications(user.id, 30) : Promise.resolve([]),
      user ? getUnreadCount(user.id) : Promise.resolve(0),
      supabase
        .from("menu_items")
        .select("label, url, icon, target, visible_to, position")
        .eq("active", true)
        .order("position", { ascending: true }),
      supabase
        .from("annual_promo")
        .select("active, badge_text, modal_title, modal_desc, button_text, link_url")
        .eq("active", true)
        .maybeSingle(),
    ]);

  const annualPromo: AnnualPromoData | null = promoRaw
    ? { ...promoRaw }
    : null;

  const navItems: NavItem[] = (menuItemsRaw ?? []).map((i) => {
    let href = i.url;
    if (user?.email && href.includes("[EMAIL]")) {
      href = href.replace(/\[EMAIL\]/g, encodeURIComponent(user.email));
    }
    return {
      label: i.label,
      href,
      icon: i.icon ?? null,
      target: (i.target as "_self" | "_blank") ?? "_self",
      visible_to: i.visible_to as "guest" | "student" | "admin",
    };
  });

  // Layout unificado — mesma estrutura HTML independente da rota.
  // Rotas públicas (/cursos) usam CatalogHeader quando não autenticadas.
  // Cada page gerencia sua própria centralização para evitar cache parcial do RSC.
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F0] w-full overflow-x-hidden">
      <ScrollToTop />
      {user ? (
        <StudentHeader
          fullName={profile?.full_name ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          role={(profile?.role ?? "student") as Role}
          userId={user.id}
          initialNotifications={initialNotifications}
          initialUnread={unreadCount}
          navItems={navItems}
          annualPromo={annualPromo}
        />
      ) : (
        <CatalogHeader isLoggedIn={false} />
      )}
      <div className="flex flex-1 w-full">
        {user && (
          <StudentNav
            navItems={navItems}
            role={(profile?.role ?? "student") as Role}
            fullName={profile?.full_name ?? ""}
          />
        )}
        <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      </div>
      <footer className="hidden md:block py-3 text-center text-xs text-muted-foreground border-t border-border/30 bg-white">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
      {user && !(profile as Record<string, unknown>)?.terms_accepted_at && (
        <TermsAcceptanceBanner />
      )}
      {user && <PushPromptBanner />}
      <UpdatePrompt />
      <InstallPrompt />
    </div>
  );
}
