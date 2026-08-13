"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sendAccessConfirmedEmail } from "@/lib/email";

export async function resendActivationAction(
  email: string
): Promise<{ error?: string; sent?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  const { data: me } = await service
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return { error: "Sem permissão." };

  const normalizedEmail = email.toLowerCase().trim();

  // Garante que não existe conta com este e-mail
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingProfile) return { error: "Esta aluna já possui uma conta." };

  // Busca tokens não-utilizados com título do curso
  const { data: tokens } = await service
    .from("activation_tokens")
    .select("id, token, expires_at, buyer_name, courses(id, title, slug)")
    .eq("email", normalizedEmail)
    .eq("used", false)
    .order("created_at", { ascending: false });

  if (!tokens || tokens.length === 0) {
    return { error: "Nenhum token de ativação pendente encontrado." };
  }

  // Renova tokens expirados
  const now = new Date();
  const newExpiry = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const expiredIds = tokens
    .filter((t) => new Date(t.expires_at) < now)
    .map((t) => t.id);
  if (expiredIds.length > 0) {
    await service
      .from("activation_tokens")
      .update({ expires_at: newExpiry })
      .in("id", expiredIds);
  }

  const buyerName =
    (tokens[0] as { buyer_name?: string | null }).buyer_name || normalizedEmail;

  let sent = 0;
  for (const t of tokens) {
    const course = (
      t as unknown as { courses?: { id: string; title: string; slug: string } | null }
    ).courses;
    if (!course) continue;
    try {
      await sendAccessConfirmedEmail({
        to: normalizedEmail,
        studentName: buyerName,
        courseTitle: course.title,
        courseSlug: course.slug,
        activationToken: t.token,
      });
      sent++;
    } catch (e) {
      console.error("[resend-activation] email error:", e);
    }
  }

  await service.from("audit_log").insert({
    admin_id: user.id,
    action: "resend_activation",
    target_type: "activation_token",
    target_id: null,
    meta: {
      email: normalizedEmail,
      emails_sent: sent,
      admin_name: me?.full_name ?? null,
    },
  });

  return { sent };
}

export async function createAccountAndSetPasswordAction(
  email: string,
  password: string
): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  const { data: me } = await service
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return { error: "Sem permissão." };

  if (password.length < 8) return { error: "A senha deve ter no mínimo 8 caracteres." };

  const normalizedEmail = email.toLowerCase().trim();

  // Verifica se já existe conta
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingProfile) return { error: "Esta aluna já possui uma conta." };

  // Busca tokens pendentes com dados da compradora
  const { data: tokens } = await service
    .from("activation_tokens")
    .select("token, course_id, buyer_name, buyer_phone")
    .eq("email", normalizedEmail)
    .eq("used", false)
    .not("course_id", "is", null);

  const buyerName = tokens?.[0]?.buyer_name ?? null;
  const buyerPhone = tokens?.[0]?.buyer_phone ?? null;

  // Cria conta Auth com e-mail já confirmado
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: buyerName },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("already been registered")
    ) {
      return { error: "Já existe uma conta com este e-mail." };
    }
    return { error: `Erro ao criar conta: ${createError.message}` };
  }

  const userId = created.user.id;

  // Atualiza perfil com nome e telefone da compra
  const profileUpdate: Record<string, string> = {};
  if (buyerName) profileUpdate.full_name = buyerName;
  if (buyerPhone) profileUpdate.phone = buyerPhone;
  if (Object.keys(profileUpdate).length > 0) {
    await service.from("profiles").update(profileUpdate).eq("id", userId);
  }

  // Concede matrículas e marca tokens como usados
  let enrollmentsGranted = 0;
  if (tokens?.length) {
    for (const t of tokens) {
      if (!t.course_id) continue;
      await service.from("enrollments").upsert(
        {
          user_id: userId,
          course_id: t.course_id,
          source: "payt",
          granted_at: new Date().toISOString(),
          expires_at: null,
        },
        { onConflict: "user_id,course_id" }
      );
      await service.from("activation_tokens").update({ used: true }).eq("token", t.token);
      enrollmentsGranted++;
    }
  }

  await service.from("audit_log").insert({
    admin_id: user.id,
    action: "create_account_with_password",
    target_type: "user",
    target_id: userId,
    meta: {
      email: normalizedEmail,
      enrollments_granted: enrollmentsGranted,
      admin_name: me?.full_name ?? null,
    },
  });

  return { userId };
}

export async function correctEmailAction(
  oldEmail: string,
  newEmail: string
): Promise<{ error?: string; sent?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  const { data: me } = await service
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return { error: "Sem permissão." };

  const normalizedOld = oldEmail.toLowerCase().trim();
  const normalizedNew = newEmail.toLowerCase().trim();

  if (normalizedOld === normalizedNew)
    return { error: "O novo e-mail é igual ao atual." };

  // Novo e-mail não pode já ter conta
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", normalizedNew)
    .maybeSingle();
  if (existingProfile)
    return { error: "Já existe uma conta com este e-mail." };

  // Busca tokens pendentes do e-mail antigo
  const { data: tokens } = await service
    .from("activation_tokens")
    .select("id, token, expires_at, buyer_name, courses(id, title, slug)")
    .eq("email", normalizedOld)
    .eq("used", false);

  if (!tokens || tokens.length === 0)
    return { error: "Nenhum token pendente encontrado para este e-mail." };

  // Renova tokens expirados e atualiza e-mail
  const now = new Date();
  const newExpiry = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const ids = tokens.map((t) => t.id);

  await service
    .from("activation_tokens")
    .update({
      email: normalizedNew,
      expires_at: newExpiry,
    })
    .in("id", ids);

  // Atualiza payment_events para manter dados limpos
  await service
    .from("payment_events")
    .update({ buyer_email: normalizedNew })
    .ilike("buyer_email", normalizedOld);

  // Reenvia e-mails para o endereço correto
  const buyerName =
    (tokens[0] as { buyer_name?: string | null }).buyer_name || normalizedNew;

  let sent = 0;
  for (const t of tokens) {
    const course = (
      t as unknown as { courses?: { id: string; title: string; slug: string } | null }
    ).courses;
    if (!course) continue;
    try {
      await sendAccessConfirmedEmail({
        to: normalizedNew,
        studentName: buyerName,
        courseTitle: course.title,
        courseSlug: course.slug,
        activationToken: t.token,
      });
      sent++;
    } catch (e) {
      console.error("[correct-email] email error:", e);
    }
  }

  await service.from("audit_log").insert({
    admin_id: user.id,
    action: "correct_buyer_email",
    target_type: "activation_token",
    target_id: null,
    meta: {
      old_email: normalizedOld,
      new_email: normalizedNew,
      tokens_updated: ids.length,
      emails_sent: sent,
      admin_name: me?.full_name ?? null,
    },
  });

  return { sent };
}
