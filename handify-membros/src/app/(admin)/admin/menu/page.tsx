import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MenuClient from "./menu-client";

export const metadata = { title: "Menu de Navegação — Admin Handify" };

export default async function AdminMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const service = createServiceClient();
  const { data: items } = await service
    .from("menu_items")
    .select("id, label, url, icon, target, visible_to, position, parent_id, active")
    .order("position", { ascending: true });

  return <MenuClient items={items ?? []} />;
}
