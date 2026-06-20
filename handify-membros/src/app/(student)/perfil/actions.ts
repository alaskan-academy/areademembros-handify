"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

// ─── Certificados ─────────────────────────────────────────────────────────────

export async function getCertificateDownloadUrl(
  certificateId: string
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: cert } = await supabase
    .from("certificates")
    .select("pdf_path")
    .eq("id", certificateId)
    .eq("user_id", user.id)
    .single();

  if (!cert?.pdf_path) return null;

  const serviceClient = createServiceClient();
  const { data } = await serviceClient.storage
    .from("certificates")
    .createSignedUrl(cert.pdf_path, 3600);

  return data?.signedUrl ?? null;
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

export async function updateProfile(data: {
  fullName: string;
  bio: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const fullName = data.fullName.trim();
  if (!fullName) return { error: "Nome não pode ser vazio" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      bio: data.bio.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/perfil");
  return {};
}

export async function uploadAvatar(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };
  if (file.size > 5 * 1024 * 1024) return { error: "Tamanho máximo: 5 MB" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return { error: "Formato inválido. Use JPG, PNG ou WebP." };

  const ext =
    file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}.${ext}`;

  const serviceClient = createServiceClient();
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await serviceClient.storage
    .from("avatars")
    .upload(path, bytes, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = serviceClient.storage.from("avatars").getPublicUrl(path);

  const urlWithBust = `${publicUrl}?t=${Date.now()}`;

  await supabase
    .from("profiles")
    .update({ avatar_url: urlWithBust })
    .eq("id", user.id);

  revalidatePath("/perfil");
  return { url: urlWithBust };
}

// ─── Preferências de e-mail ───────────────────────────────────────────────────

export type EmailPrefs = {
  certificate: boolean;
  reengagement: boolean;
  news_post: boolean;
};

export async function updateEmailPrefs(
  prefs: EmailPrefs
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({ email_prefs: prefs })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}
