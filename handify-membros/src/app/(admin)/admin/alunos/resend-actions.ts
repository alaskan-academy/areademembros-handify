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
    now.getTime() + 7 * 24 * 60 * 60 * 1000
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
