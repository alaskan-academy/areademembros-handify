"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendNewsPostEmail } from "@/lib/email";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Não autorizado");
  return { supabase, user };
}

export async function uploadCommunityImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  await assertAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo obrigatório" };
  if (file.size > 5_242_880) return { error: "Imagem muito grande (max 5MB)" };
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
    return { error: "Formato inválido. Use JPG, PNG, WebP ou GIF" };

  const service = createServiceClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `feed/${Date.now()}.${ext}`;
  const { error } = await service.storage.from("community").upload(path, file, { upsert: false });
  if (error) return { error: "Erro ao fazer upload da imagem" };

  const { data: urlData } = service.storage.from("community").getPublicUrl(path);
  return { url: urlData.publicUrl };
}

const postSchema = z.object({
  title: z.string().min(3, "Título muito curto").max(200, "Título muito longo"),
  body: z.string().max(10000, "Texto muito longo"),
  image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  published: z.boolean(),
  pinned: z.boolean(),
});

export async function createNewsPost(formData: FormData): Promise<{ error?: string }> {
  const { user } = await assertAdmin();

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    image_url: formData.get("image_url") ?? "",
    published: formData.get("published") === "true",
    pinned: formData.get("pinned") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").insert({
    author_id: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
    image_url: parsed.data.image_url || null,
    published: parsed.data.published,
    pinned: parsed.data.pinned,
  });

  if (error) return { error: "Erro ao criar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}

export async function updateNewsPost(id: string, formData: FormData): Promise<{ error?: string }> {
  await assertAdmin();

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    image_url: formData.get("image_url") ?? "",
    published: formData.get("published") === "true",
    pinned: formData.get("pinned") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").update({
    title: parsed.data.title,
    body: parsed.data.body,
    image_url: parsed.data.image_url || null,
    published: parsed.data.published,
    pinned: parsed.data.pinned,
  }).eq("id", id);

  if (error) return { error: "Erro ao atualizar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}

export async function deleteNewsPost(id: string): Promise<{ error?: string }> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").delete().eq("id", id);
  if (error) return { error: "Erro ao deletar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}

export async function toggleNewsPublished(
  id: string,
  published: boolean
): Promise<{ error?: string }> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").update({ published }).eq("id", id);
  if (error) return { error: "Erro ao atualizar status" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");

  if (published) void notifyNewsPost(id);
  return {};
}

async function notifyNewsPost(postId: string) {
  try {
    const service = createServiceClient();
    const { data: post } = await service
      .from("news_posts")
      .select("title, body")
      .eq("id", postId)
      .single();
    if (!post) return;

    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, email, email_prefs")
      .eq("role", "student")
      .eq("banned", false)
      .not("email", "is", null);

    if (!profiles?.length) return;

    // In-app notifications em batch
    const BATCH = 500;
    for (let i = 0; i < profiles.length; i += BATCH) {
      const batch = profiles.slice(i, i + BATCH).map((p) => ({
        user_id: p.id,
        type: "news_post",
        title: "Nova publicação",
        body: post.title,
        link: `/comunidade/feed`,
        read: false,
      }));
      await service.from("notifications").insert(batch);
    }

    // E-mails apenas para quem não optou por não receber
    const eligible = profiles.filter(
      (p) => (p.email_prefs as Record<string, boolean> | null)?.news_post !== false
    );

    for (const p of eligible) {
      await sendNewsPostEmail({
        to: p.email,
        studentName: p.full_name ?? "Aluna",
        postTitle: post.title,
        postBody: post.body ?? undefined,
        postId,
      });
    }
  } catch (e) {
    console.error("[email] notifyNewsPost:", e);
  }
}

export type AdminFeedComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

export async function getNewsCommentsAdmin(postId: string): Promise<AdminFeedComment[]> {
  await assertAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("news_comments")
    .select("id, body, created_at, user_id, profiles!user_id(full_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data as unknown as AdminFeedComment[]) ?? [];
}

export async function deleteNewsCommentAdmin(commentId: string): Promise<{ error?: string }> {
  await assertAdmin();
  const service = createServiceClient();
  const { error } = await service.from("news_comments").delete().eq("id", commentId);
  if (error) return { error: "Erro ao deletar comentário" };
  return {};
}

export async function toggleNewsPinned(
  id: string,
  pinned: boolean
): Promise<{ error?: string }> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").update({ pinned }).eq("id", id);
  if (error) return { error: "Erro ao fixar/desfixar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}
