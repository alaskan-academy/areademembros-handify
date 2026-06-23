"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { sendWelcomeEmail } from "@/lib/email";
import { z } from "zod";

const ActivateSchema = z.object({
  token: z.string().uuid("Token inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirm_password: z.string(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
}).refine((d) => d.password === d.confirm_password, {
  message: "As senhas não coincidem",
  path: ["confirm_password"],
});

export type ActivateResult = { error?: string; success?: boolean };

export async function validateToken(
  token: string
): Promise<{ email?: string; error?: string }> {
  const service = createServiceClient();
  const { data } = await service
    .from("activation_tokens")
    .select("email, used, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return { error: "Link inválido ou expirado." };
  if (data.used) return { error: "Este link já foi utilizado. Faça login normalmente." };
  if (new Date(data.expires_at) < new Date()) return { error: "Este link expirou. Entre em contato com o suporte." };

  return { email: data.email };
}


export async function activateAccount(
  formData: FormData
): Promise<ActivateResult> {
  const raw = {
    token: formData.get("token"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
    date_of_birth: formData.get("date_of_birth") ?? "",
  };

  const parsed = ActivateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const service = createServiceClient();

  // Revalida token
  const { data: tokenRow } = await service
    .from("activation_tokens")
    .select("email, used, expires_at, course_id")
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (!tokenRow || tokenRow.used || new Date(tokenRow.expires_at) < new Date()) {
    return { error: "Link inválido, já utilizado ou expirado." };
  }

  const email = tokenRow.email;

  // Verifica se já tem conta
  const { data: existing } = await service.auth.admin.listUsers();
  const alreadyExists = existing?.users?.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (alreadyExists) {
    // Marca token como usado e pede para fazer login
    await service.from("activation_tokens").update({ used: true }).eq("token", parsed.data.token);
    return { error: "Você já possui uma conta com este e-mail. Faça login normalmente." };
  }

  // Cria conta no Supabase Auth
  const { data: created, error: signUpError } = await service.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true, // já confirma direto — fluxo de ativação substitui a verificação
  });

  if (signUpError || !created?.user) {
    return { error: "Erro ao criar conta. Tente novamente ou entre em contato com o suporte." };
  }

  // Salva data de nascimento no perfil (se informada)
  if (parsed.data.date_of_birth) {
    await service
      .from("profiles")
      .update({ date_of_birth: parsed.data.date_of_birth })
      .eq("id", created.user.id);
  }

  // Concede matrícula pendente (caso tenha comprado antes de criar conta)
  if (tokenRow.course_id) {
    await service.from("enrollments").upsert(
      {
        user_id: created.user.id,
        course_id: tokenRow.course_id,
        source: "payt",
        granted_at: new Date().toISOString(),
        expires_at: null,
      },
      { onConflict: "user_id,course_id" }
    );
  }

  // Marca token como usado
  await service
    .from("activation_tokens")
    .update({ used: true })
    .eq("token", parsed.data.token);

  // Boas-vindas
  const { data: profile } = await service
    .from("profiles")
    .select("full_name")
    .eq("id", created.user.id)
    .maybeSingle();

  sendWelcomeEmail({
    to: email,
    studentName: profile?.full_name ?? email,
  }).catch((e) => console.error("[activate] welcome email:", e));

  return { success: true };
}
