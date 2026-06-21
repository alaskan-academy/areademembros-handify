"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  return { supabase, user };
}

const postSchema = z.object({
  title: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(200, "Título muito longo"),
  body: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres").max(5000, "Máximo 5000 caracteres"),
});

export async function createForumPost(
  courseId: string,
  courseSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("forum_posts")
    .insert({
      course_id: courseId,
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    });

  if (error) return { error: "Erro ao criar post" };

  revalidatePath(`/comunidade/forum/${courseSlug}`);
  return {};
}

export async function deleteForumPost(
  postId: string,
  courseSlug: string
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar post" };
  revalidatePath(`/comunidade/forum/${courseSlug}`);
  return {};
}

const commentSchema = z.object({
  body: z.string().min(1, "Comentário vazio").max(2000, "Máximo 2000 caracteres"),
});

export async function addForumComment(
  postId: string,
  body: string
): Promise<{ id: string; body: string; created_at: string; user_id: string; parent_id: string | null; profiles: { full_name: string; avatar_url: string | null } | null } | { error: string }> {
  const parsed = commentSchema.safeParse({ body });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("forum_comments")
    .insert({ post_id: postId, user_id: user.id, body: parsed.data.body })
    .select("id, body, created_at, user_id, parent_id, profiles!user_id (full_name, avatar_url)")
    .single();

  if (error) return { error: "Erro ao comentar" };

  return data as unknown as { id: string; body: string; created_at: string; user_id: string; parent_id: string | null; profiles: { full_name: string; avatar_url: string | null } | null };
}

export async function deleteForumComment(commentId: string): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("forum_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar comentário" };
  return {};
}

export async function toggleForumLike(postId: string): Promise<{ liked: boolean }> {
  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("post_likes")
    .select("user_id")
    .eq("target_type", "forum_post")
    .eq("target_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("target_type", "forum_post")
      .eq("target_id", postId)
      .eq("user_id", user.id);
    return { liked: false };
  } else {
    await supabase
      .from("post_likes")
      .insert({ target_type: "forum_post", target_id: postId, user_id: user.id });
    return { liked: true };
  }
}
