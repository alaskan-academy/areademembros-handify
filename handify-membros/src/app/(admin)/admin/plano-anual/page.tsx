import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AnnualPromoClient from "./AnnualPromoClient";
import type { AnnualPromo } from "./actions";

export default async function PlanoAnualAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: promo } = await supabase
    .from("annual_promo")
    .select("*")
    .single();

  const defaultPromo: AnnualPromo = {
    id: "",
    active: false,
    link_url: "",
    badge_text: "Plano Anual",
    modal_title: "Assine o Plano Anual Handify™",
    modal_desc: "",
    button_text: "Assinar agora",
  };

  return (
    <div className="p-6 lg:p-8">
      <AnnualPromoClient promo={(promo as AnnualPromo) ?? defaultPromo} />
    </div>
  );
}
