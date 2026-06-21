"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Acesso negado");
  return supabase;
}

function slugify(text: string) {
  return text.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createForum(
  title: string, description: string
): Promise<{ id?: string; slug?: string; error?: string }> {
  const supabase = await assertAdmin();
  if (!title.trim()) return { error: "Título obrigatório" };
  const slug = slugify(title);
  const { data, error } = await supabase
    .from("forums").insert({ title: title.trim(), slug, description: description.trim() || null })
    .select("id, slug").single();
  if (error) return { error: "Erro ao criar fórum: " + error.message };
  revalidatePath("/admin/forums");
  revalidatePath("/admin/cursos");
  return { id: data.id, slug: data.slug };
}

export async function updateForum(
  id: string, title: string, description: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  if (!title.trim()) return { error: "Título obrigatório" };
  const slug = slugify(title);
  const { error } = await supabase
    .from("forums").update({ title: title.trim(), slug, description: description.trim() || null }).eq("id", id);
  if (error) return { error: "Erro ao atualizar: " + error.message };
  revalidatePath("/admin/forums");
  revalidatePath("/admin/cursos");
  return {};
}

export async function deleteForum(id: string): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("forums").delete().eq("id", id);
  if (error) return { error: "Erro ao excluir fórum: " + error.message };
  revalidatePath("/admin/forums");
  revalidatePath("/admin/cursos");
  return {};
}
