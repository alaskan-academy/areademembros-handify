"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") throw new Error("Acesso negado");
  return supabase;
}

export type AnnualPromo = {
  id: string;
  active: boolean;
  link_url: string;
  badge_text: string;
  modal_title: string;
  modal_desc: string;
  button_text: string;
};

export async function saveAnnualPromo(data: Omit<AnnualPromo, "id">): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { data: existing } = await supabase.from("annual_promo").select("id").single();
  if (!existing) return { error: "Configuração não encontrada. Rode a migration 021." };

  const { error } = await supabase
    .from("annual_promo")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) return { error: error.message };
  revalidatePath("/admin/plano-anual");
  revalidatePath("/dashboard");
  revalidatePath("/cursos");
  return {};
}
