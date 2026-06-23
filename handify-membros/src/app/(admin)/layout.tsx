import { createClient } from "@/lib/supabase/server";
import UpdatePrompt from "@/components/pwa/UpdatePrompt";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { redirect } from "next/navigation";
import AdminHeader from "@/components/admin-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      <UpdatePrompt />
      <InstallPrompt />
    </div>
  );
}
