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

export async function toggleNewsLike(postId: string): Promise<{ liked: boolean }> {
  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("post_likes")
    .select("user_id")
    .eq("target_type", "news_post")
    .eq("target_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("target_type", "news_post")
      .eq("target_id", postId)
      .eq("user_id", user.id);
    return { liked: false };
  } else {
    await supabase
      .from("post_likes")
      .insert({ target_type: "news_post", target_id: postId, user_id: user.id });
    return { liked: true };
  }
}

const commentSchema = z.object({
  body: z.string().min(1, "Comentário não pode ser vazio").max(2000, "Máximo 2000 caracteres"),
});

export async function addNewsComment(
  postId: string,
  body: string
): Promise<{ id: string; body: string; created_at: string; user_id: string; profiles: { full_name: string; avatar_url: string | null } | null } | { error: string }> {
  const parsed = commentSchema.safeParse({ body });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("news_comments")
    .insert({ post_id: postId, user_id: user.id, body: parsed.data.body })
    .select("id, body, created_at, user_id, profiles!user_id (full_name, avatar_url)")
    .single();

  if (error) return { error: "Erro ao comentar" };

  revalidatePath("/comunidade/feed");

  return data as unknown as { id: string; body: string; created_at: string; user_id: string; profiles: { full_name: string; avatar_url: string | null } | null };
}

export async function deleteNewsComment(commentId: string): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("news_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar comentário" };
  revalidatePath("/comunidade/feed");
  return {};
}
