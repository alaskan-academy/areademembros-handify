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

export async function approveForumPost(postId: string, forumSlug: string): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("forum_posts").update({ approved: true }).eq("id", postId);
  if (error) return { error: "Erro ao aprovar post" };
  revalidatePath("/admin/comunidade/forum");
  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

export async function rejectForumPost(postId: string, forumSlug: string): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
  if (error) return { error: "Erro ao rejeitar post" };
  revalidatePath("/admin/comunidade/forum");
  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

export async function deleteAdminForumPost(postId: string, forumSlug: string): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
  if (error) return { error: "Erro ao deletar post" };
  revalidatePath("/admin/comunidade/forum");
  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

export async function toggleAdminForumPin(postId: string, currentPinned: boolean): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("forum_posts").update({ pinned: !currentPinned }).eq("id", postId);
  if (error) return { error: "Erro ao alterar fixação" };
  revalidatePath("/admin/comunidade/forum");
  return {};
}
