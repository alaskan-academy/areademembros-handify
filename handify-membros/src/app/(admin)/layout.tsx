import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import UpdatePrompt from "@/components/pwa/UpdatePrompt";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import BackButtonGuard from "@/components/pwa/BackButtonGuard";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import ScrollToTop from "@/components/layout/ScrollToTop";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const service = createServiceClient();
  const { count: pendingForumCount } = await service
    .from("forum_posts")
    .select("*", { count: "exact", head: true })
    .eq("approved", false);

  return (
    <div className="min-h-screen bg-[#F5F5F0] overflow-x-hidden">
      <ScrollToTop />
      <AdminNav pendingForumCount={pendingForumCount ?? 0}>
        <main className="px-4 sm:px-6 md:px-8 py-6 md:py-8 min-w-0">
          {children}
        </main>
      </AdminNav>
      <BackButtonGuard />
      <UpdatePrompt />
      <InstallPrompt />
    </div>
  );
}
