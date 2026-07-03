"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ForumCommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: { full_name: string; avatar_url: string | null; role: string } | null;
};

export async function getForumComments(postId: string): Promise<ForumCommentRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const service = createServiceClient();
  const { data } = await service
    .from("forum_comments")
    .select("id, body, created_at, user_id, parent_id, profiles!user_id(full_name, avatar_url, role)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data as unknown as ForumCommentRow[]) ?? [];
}

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  return { supabase, user };
}

export async function uploadForumFile(
  formData: FormData
): Promise<{ url?: string; name?: string; error?: string }> {
  const { user } = await getAuthUser();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo obrigatório" };
  if (file.size > 10_485_760) return { error: "Arquivo muito grande (max 10MB)" };

  const fileType = formData.get("file_type") as string | null;
  const isAttachment = fileType === "file";

  const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_FILE_MIME = [
    ...ALLOWED_IMAGE_MIME,
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.ms-excel",
    "text/plain",
  ];

  const allowed = isAttachment ? ALLOWED_FILE_MIME : ALLOWED_IMAGE_MIME;
  const mimeError = isAttachment
    ? "Tipo não permitido. Use: PDF, ZIP, RAR, DOCX, XLSX, PPTX, TXT ou imagem."
    : "Apenas imagens são permitidas (JPEG, PNG, WebP, GIF)";

  if (!allowed.includes(file.type)) return { error: mimeError };

  const service = createServiceClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `forum/${user.id}/${Date.now()}.${ext}`;
  const { error } = await service.storage.from("community").upload(path, file, { upsert: false });
  if (error) return { error: "Erro ao fazer upload" };

  const { data: urlData } = service.storage.from("community").getPublicUrl(path);
  const isImage = file.type.startsWith("image/");
  return { url: urlData.publicUrl, name: isImage ? undefined : file.name };
}

const postSchema = z.object({
  title: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(200, "Título muito longo"),
  body: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres").max(5000, "Máximo 5000 caracteres"),
});

export async function createForumPost(
  forumId: string,
  forumSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const imageUrl = (formData.get("image_url") as string) || null;
  const attachmentUrl = (formData.get("attachment_url") as string) || null;
  const attachmentName = (formData.get("attachment_name") as string) || null;

  const { error } = await supabase
    .from("forum_posts")
    .insert({
      forum_id: forumId,
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      image_url: imageUrl,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      approved: false,
    });

  if (error) return { error: "Erro ao criar post" };

  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

export async function deleteForumPost(
  postId: string,
  forumSlug: string
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar post" };
  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

const commentSchema = z.object({
  body: z.string().min(1, "Comentário vazio").max(2000, "Máximo 2000 caracteres"),
});

export async function addForumComment(
  postId: string,
  body: string
): Promise<{ id: string; body: string; created_at: string; user_id: string; parent_id: string | null; profiles: { full_name: string; avatar_url: string | null; role: string } | null } | { error: string }> {
  const parsed = commentSchema.safeParse({ body });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("forum_comments")
    .insert({ post_id: postId, user_id: user.id, body: parsed.data.body })
    .select("id, body, created_at, user_id, parent_id, profiles!user_id (full_name, avatar_url, role)")
    .single();

  if (error) return { error: "Erro ao comentar" };

  return data as unknown as { id: string; body: string; created_at: string; user_id: string; parent_id: string | null; profiles: { full_name: string; avatar_url: string | null; role: string } | null };
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
