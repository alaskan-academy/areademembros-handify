"use server";

import { traduzErroAuth } from "@/lib/auth/mensagens-erro";
import { z } from "zod";
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

/**
 * Nome e bio nao tinham tamanho maximo: dava para gravar texto gigante no
 * banco, que depois aparece no perfil publico da aluna.
 */
const PerfilSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Nome não pode ser vazio")
    .max(120, "Nome muito longo (máximo 120 caracteres)"),
  bio: z.string().trim().max(500, "Bio muito longa (máximo 500 caracteres)"),
});

export async function updateProfile(data: {
  fullName: string;
  bio: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = PerfilSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { fullName, bio } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      bio: bio || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[perfil] updateProfile:", error.message);
    return { error: "Não foi possível salvar seu perfil. Tente novamente." };
  }
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

// ─── Senha ────────────────────────────────────────────────────────────────────

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Não autenticado" };

  if (data.newPassword.length < 8) return { error: "A nova senha deve ter pelo menos 8 caracteres." };

  // Verifica senha atual via re-autenticação
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.currentPassword,
  });
  if (signInError) return { error: "Senha atual incorreta." };

  const { error } = await supabase.auth.updateUser({ password: data.newPassword });
  if (error) return { error: traduzErroAuth(error.message, "Não foi possível trocar a senha. Tente novamente.") };
  return {};
}

// ─── Preferências de e-mail ───────────────────────────────────────────────────

export type EmailPrefs = {
  certificate: boolean;
  reengagement: boolean;
  news_post: boolean;
  new_course: boolean;
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

  if (error) {
    console.error("[perfil] email_prefs:", error.message);
    return { error: "Não foi possível salvar suas preferências. Tente novamente." };
  }
  return {};
}
