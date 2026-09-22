"use server";

import { traduzErroAuth } from "@/lib/auth/mensagens-erro";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";
import { escaparCuringas } from "@/lib/db/like";
import { sendAccessConfirmedEmail, sendLoginReminderEmail } from "@/lib/email";

export async function getAdminId(): Promise<string> {
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

  // E-mail de acesso liberado em background
  ;(async () => {
    const [{ data: profile }, { data: course }] = await Promise.all([
      service.from("profiles").select("email, full_name").eq("id", user_id).single(),
      service.from("courses").select("title, slug").eq("id", course_id).single(),
    ]);
    if (profile?.email && course?.title) {
      await sendAccessConfirmedEmail({
        to: profile.email,
        studentName: profile.full_name ?? profile.email,
        courseTitle: course.title,
        courseSlug: course.slug,
      });
    }
  })().catch((e) => console.error("[grantAccess] email:", e));

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
  cpf: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.replace(/\D/g, "").length === 11,
      "CPF deve ter 11 dígitos"
    ),
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
    cpf: formData.get("cpf") || "",
    admin_notes: formData.get("admin_notes") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user_id, full_name, email, phone, date_of_birth, cpf, admin_notes } = parsed.data;
  const rawCpf = cpf ? cpf.replace(/\D/g, "") : "";
  const service = createServiceClient();

  // Busca e-mail atual para detectar se mudou
  const { data: current } = await service
    .from("profiles")
    .select("email")
    .eq("id", user_id)
    .single();

  const emailChanged = current?.email?.toLowerCase() !== email.toLowerCase();

  if (emailChanged) {
    // Esta é a ação que a tela de perfil da aluna usa de verdade. A checagem de
    // duplicata tinha sido escrita em 12/09 dentro de updateStudentEmailAction,
    // que não tem chamador nenhum — ou seja, estava num caminho morto e a troca
    // pela tela continuava sem guarda. Foi assim que 18 pessoas ficaram com
    // conta duplicada, e é por isso que não existe nenhum `update_email` no
    // audit_log: quem registra aqui é `update_profile`.
    const conflito = await contaJaUsaEsteEmail(service, email, user_id);
    if (conflito) return { error: conflito };

    const { error: authErr } = await service.auth.admin.updateUserById(user_id, {
      email,
      email_confirm: true,
    });
    if (authErr) {
      console.error("[updateProfile] auth error:", authErr);
      return { error: traduzErroAuth(authErr.message, `Erro ao atualizar e-mail: ${authErr.message}`) };
    }
  }

  const updateData: Record<string, unknown> = {
    full_name,
    phone: phone || null,
    date_of_birth: date_of_birth || null,
    admin_notes: admin_notes || null,
  };
  if (emailChanged) updateData.email = email;
  if (rawCpf.length === 11) {
    updateData.cpf_encrypted = encryptCpf(rawCpf);
    updateData.cpf_hash = hashCpf(rawCpf);
  }

  const { error } = await service
    .from("profiles")
    .update(updateData)
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
      cpf_updated: rawCpf.length === 11,
    },
  });

  revalidatePath(`/admin/alunos/${user_id}`);
  return { success: "Perfil atualizado com sucesso." };
}

// ─── Dar acesso em lote ───────────────────────────────────────────────────────

const grantMultipleSchema = z.object({
  user_id: z.string().uuid(),
  course_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um curso"),
  reason: z.string().min(1, "Informe o motivo"),
  expires_at: z.string().optional(),
});

export async function grantMultipleAccessAction(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = grantMultipleSchema.safeParse({
    user_id: formData.get("user_id"),
    course_ids: formData.getAll("course_id"),
    reason: formData.get("reason"),
    expires_at: formData.get("expires_at") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user_id, course_ids, reason, expires_at } = parsed.data;
  const service = createServiceClient();
  const now = new Date().toISOString();

  let granted = 0;
  let skipped = 0;

  for (const course_id of course_ids) {
    const { data: existing } = await service
      .from("enrollments")
      .select("id, expires_at")
      .eq("user_id", user_id)
      .eq("course_id", course_id)
      .maybeSingle();

    if (existing) {
      const isActive = !existing.expires_at || new Date(existing.expires_at) > new Date();
      if (isActive) { skipped++; continue; }
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
      console.error("[grantMultiple] insert error:", enrollErr);
      continue;
    }

    await service.from("audit_log").insert({
      admin_id: adminId,
      action: "grant_access",
      target_type: "enrollment",
      target_id: enrollment.id,
      meta: { user_id, course_id, reason, expires_at: expires_at ?? null },
    });

    ;(async () => {
      const [{ data: profile }, { data: course }] = await Promise.all([
        service.from("profiles").select("email, full_name").eq("id", user_id).single(),
        service.from("courses").select("title, slug").eq("id", course_id).single(),
      ]);
      if (profile?.email && course?.title) {
        await sendAccessConfirmedEmail({
          to: profile.email,
          studentName: profile.full_name ?? profile.email,
          courseTitle: course.title,
          courseSlug: course.slug,
        });
      }
    })().catch((e) => console.error("[grantMultiple] email:", e));

    granted++;
  }

  revalidatePath(`/admin/alunos/${user_id}`);

  if (granted === 0) {
    return { error: "Nenhum acesso concedido. Todos os cursos selecionados já têm matrícula ativa." };
  }

  return {
    success: `${granted} curso${granted !== 1 ? "s" : ""} liberado${granted !== 1 ? "s" : ""} com sucesso.${skipped > 0 ? ` (${skipped} já tinham acesso)` : ""}`,
  };
}

// ─── Reenviar email de acesso (aluna com conta) ───────────────────────────────

export async function resendAccessEmailAction(
  userId: string
): Promise<{ error?: string; success?: boolean }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (!profile?.email) return { error: "Perfil não encontrado." };

  try {
    await sendLoginReminderEmail({
      to: profile.email,
      studentName: profile.full_name ?? profile.email,
    });
  } catch (e) {
    console.error("[resendAccess] email error:", e);
    return { error: "Erro ao enviar e-mail. Tente novamente." };
  }

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "resend_access_email",
    target_type: "user",
    target_id: userId,
    meta: { email: profile.email },
  });

  return { success: true };
}

// ─── Definir senha ───────────────────────────────────────────────────────────

export async function setStudentPasswordAction(
  userId: string,
  password: string
): Promise<{ error?: string }> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (password.length < 8) {
    return { error: "A senha deve ter no mínimo 8 caracteres." };
  }

  const service = createServiceClient();
  // email_confirm: true garante que conta inativa/não confirmada seja ativada junto
  const { error } = await service.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (error) return { error: traduzErroAuth(error.message, "Não foi possível definir a senha. Tente novamente.") };

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "set_password",
    target_type: "user",
    target_id: userId,
    meta: {},
  });

  return {};
}
// ─── E-mail duplicado ────────────────────────────────────────────────────────

/**
 * Mensagem de erro quando outro perfil já usa este endereço, ou null quando
 * está livre. Usada por `updateProfileAction`, que é a ação da tela de perfil.
 *
 * Sem isto, o Supabase devolve um erro técnico em inglês que não diz o
 * essencial: que existe uma segunda conta da mesma aluna, provavelmente com os
 * cursos dela do outro lado. A saída costumava ser criar conta nova — foi assim
 * que 18 pessoas ficaram duplicadas.
 *
 * Havia aqui uma segunda função, `updateStudentEmailAction`, com esta mesma
 * guarda dentro. Ela não tinha chamador nenhum: a guarda foi escrita em 12/09
 * num caminho morto, e a troca de e-mail pela tela seguiu sem proteção. Removida
 * para não haver de novo duas funções fazendo a mesma coisa, com a correção na
 * errada.
 */
async function contaJaUsaEsteEmail(
  service: ReturnType<typeof createServiceClient>,
  email: string,
  ignorarUserId: string
): Promise<string | null> {
  const { data: jaExiste } = await service
    .from("profiles")
    .select("id, full_name")
    .ilike("email", escaparCuringas(email.toLowerCase()))
    .neq("id", ignorarUserId)
    .maybeSingle();

  if (!jaExiste) return null;

  const { count } = await service
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", jaExiste.id);

  const nome = jaExiste.full_name || "sem nome";
  const quantos = count === 1 ? "1 curso" : `${count ?? 0} cursos`;
  return (
    `Já existe outra conta com ${email.toLowerCase()} (${nome}, ${quantos}). ` +
    `Trocar o e-mail aqui não junta as duas — a aluna continuaria com os cursos divididos. ` +
    `Abra a outra conta e transfira os cursos antes, ou use esta conta e ignore a outra.`
  );
}
