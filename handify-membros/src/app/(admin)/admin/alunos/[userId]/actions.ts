"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

async function getAdminId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Sem permissão");

  return user.id;
}

// ─── Dar acesso ───────────────────────────────────────────────────────────────

const grantSchema = z.object({
  user_id: z.string().uuid(),
  course_id: z.string().uuid(),
  reason: z.string().min(1, "Informe o motivo"),
  expires_at: z.string().optional(),
});

export async function grantAccessAction(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = grantSchema.safeParse({
    user_id: formData.get("user_id"),
    course_id: formData.get("course_id"),
    reason: formData.get("reason"),
    expires_at: formData.get("expires_at") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user_id, course_id, reason, expires_at } = parsed.data;
  const service = createServiceClient();
  const now = new Date().toISOString();

  // Verifica se já existe matrícula ativa
  const { data: existing } = await service
    .from("enrollments")
    .select("id, expires_at")
    .eq("user_id", user_id)
    .eq("course_id", course_id)
    .maybeSingle();

  if (existing) {
    const isActive =
      !existing.expires_at || new Date(existing.expires_at) > new Date();
    if (isActive) return { error: "Aluna já tem acesso ativo a este curso." };

    // Remove matrícula expirada antes de reinserir (unique constraint)
    await service.from("enrollments").delete().eq("id", existing.id);
  }

  const { data: enrollment, error: enrollErr } = await service
    .from("enrollments")
    .insert({
      user_id,
      course_id,
      source: "manual",
      granted_at: now,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
    })
    .select("id")
    .single();

  if (enrollErr) {
    console.error("[grantAccess] insert error:", enrollErr);
    return { error: `Erro ao dar acesso: ${enrollErr.message}` };
  }

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "grant_access",
    target_type: "enrollment",
    target_id: enrollment.id,
    meta: { user_id, course_id, reason, expires_at: expires_at ?? null },
  });

  revalidatePath(`/admin/alunos/${user_id}`);
  return { success: "Acesso concedido com sucesso." };
}

// ─── Revogar acesso ───────────────────────────────────────────────────────────

const revokeSchema = z.object({
  user_id: z.string().uuid(),
  enrollment_id: z.string().uuid(),
  course_id: z.string().uuid(),
  reason: z.string().min(1, "Informe o motivo"),
});

export async function revokeAccessAction(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = revokeSchema.safeParse({
    user_id: formData.get("user_id"),
    enrollment_id: formData.get("enrollment_id"),
    course_id: formData.get("course_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user_id, enrollment_id, course_id, reason } = parsed.data;
  const service = createServiceClient();

  const { error: delErr } = await service
    .from("enrollments")
    .delete()
    .eq("id", enrollment_id)
    .eq("user_id", user_id);

  if (delErr) {
    console.error("[revokeAccess] delete error:", delErr);
    return { error: "Erro ao revogar acesso. Tente novamente." };
  }

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "revoke_access",
    target_type: "enrollment",
    target_id: enrollment_id,
    meta: { user_id, course_id, reason },
  });

  revalidatePath(`/admin/alunos/${user_id}`);
  return { success: "Acesso revogado." };
}

// ─── Banir / Desbanir ─────────────────────────────────────────────────────────

export async function toggleBanAction(
  userId: string,
  banned: boolean
): Promise<{ error?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ banned })
    .eq("id", userId);

  if (error) return { error: "Erro ao atualizar status." };

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: banned ? "ban" : "unban",
    target_type: "user",
    target_id: userId,
    meta: {},
  });

  revalidatePath(`/admin/alunos/${userId}`);
  revalidatePath("/admin/alunos");
  return {};
}

// ─── Atualizar perfil ────────────────────────────────────────────────────────

const profileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().min(1, "Nome obrigatório").max(200),
  email: z.string().email("E-mail inválido"),
  phone: z.string().max(30).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  admin_notes: z.string().max(5000).optional().or(z.literal("")),
});

export async function updateProfileAction(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = profileSchema.safeParse({
    user_id: formData.get("user_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    date_of_birth: formData.get("date_of_birth") || "",
    admin_notes: formData.get("admin_notes") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user_id, full_name, email, phone, date_of_birth, admin_notes } = parsed.data;
  const service = createServiceClient();

  // Busca e-mail atual para detectar se mudou
  const { data: current } = await service
    .from("profiles")
    .select("email")
    .eq("id", user_id)
    .single();

  const emailChanged = current?.email?.toLowerCase() !== email.toLowerCase();

  if (emailChanged) {
    const { error: authErr } = await service.auth.admin.updateUserById(user_id, {
      email,
      email_confirm: true,
    });
    if (authErr) return { error: `Erro ao atualizar e-mail: ${authErr.message}` };
  }

  const { error } = await service
    .from("profiles")
    .update({
      full_name,
      email: emailChanged ? email : undefined,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      admin_notes: admin_notes || null,
    })
    .eq("id", user_id);

  if (error) {
    console.error("[updateProfile] error:", error);
    return { error: "Erro ao salvar perfil. Tente novamente." };
  }

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "update_profile",
    target_type: "user",
    target_id: user_id,
    meta: {
      full_name,
      email: emailChanged ? email : undefined,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
    },
  });

  revalidatePath(`/admin/alunos/${user_id}`);
  return { success: "Perfil atualizado com sucesso." };
}

// ─── Atualizar e-mail ─────────────────────────────────────────────────────────

const emailSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email("E-mail inválido"),
});

export async function updateStudentEmailAction(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = emailSchema.safeParse({
    user_id: formData.get("user_id"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user_id, email } = parsed.data;
  const service = createServiceClient();

  // Atualiza no Auth (sem exigir confirmação de e-mail)
  const { error: authErr } = await service.auth.admin.updateUserById(user_id, {
    email,
    email_confirm: true,
  });
  if (authErr) {
    console.error("[updateEmail] auth error:", authErr);
    return { error: `Erro ao atualizar e-mail: ${authErr.message}` };
  }

  // Sincroniza no profiles
  await service.from("profiles").update({ email }).eq("id", user_id);

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "update_email",
    target_type: "user",
    target_id: user_id,
    meta: { new_email: email },
  });

  revalidatePath(`/admin/alunos/${user_id}`);
  return { success: "E-mail atualizado com sucesso." };
}
