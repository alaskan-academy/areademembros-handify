import type { ReactNode } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StudentHeader from "@/components/student-header";
import CatalogHeader from "@/components/catalog-header";
import { getUnreadCount, getNotifications } from "@/lib/notifications/actions";
import type { Role } from "@/types";

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

  const [{ data: profile }, initialNotifications, unreadCount] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name, avatar_url, role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user ? getNotifications(user.id, 30) : Promise.resolve([]),
    user ? getUnreadCount(user.id) : Promise.resolve(0),
  ]);

  // /cursos: logada usa StudentHeader (consistência), visitante usa CatalogHeader
  if (isPublic) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F5F5F0]">
        {user ? (
          <StudentHeader
            fullName={profile?.full_name ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            role={(profile?.role ?? "student") as Role}
            userId={user.id}
            initialNotifications={initialNotifications}
            initialUnread={unreadCount}
          />
        ) : (
          <CatalogHeader isLoggedIn={false} />
        )}
        <main className="flex-1">{children}</main>
        <footer className="py-3 text-center text-xs text-muted-foreground border-t border-border/30 bg-white">
          © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F0]">
      <StudentHeader
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        role={(profile?.role ?? "student") as Role}
        userId={user!.id}
        initialNotifications={initialNotifications}
        initialUnread={unreadCount}
      />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="py-3 text-center text-xs text-muted-foreground border-t border-border/30 bg-white">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
