import { createClient } from "@/lib/supabase/server";
import UpdatePrompt from "@/components/pwa/UpdatePrompt";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <AdminNav />
      <main className="md:ml-60 px-4 sm:px-6 md:px-8 py-6 md:py-8">
        {children}
      </main>
      <UpdatePrompt />
      <InstallPrompt />
    </div>
  );
}
