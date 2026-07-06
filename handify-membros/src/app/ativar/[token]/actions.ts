"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { sendWelcomeEmail } from "@/lib/email";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";
import { z } from "zod";

const ActivateSchema = z.object({
  token: z.string().uuid("Token inválido"),
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirm_password: z.string(),
  phone: z.string().min(10, "WhatsApp é obrigatório"),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
}).refine((d) => d.password === d.confirm_password, {
  message: "As senhas não coincidem",
  path: ["confirm_password"],
});

export type ActivateResult = { error?: string; success?: boolean };

export async function validateToken(
  token: string
): Promise<{ email?: string; defaultName?: string; defaultPhone?: string; error?: string }> {
  const service = createServiceClient();
  const { data } = await service
    .from("activation_tokens")
    .select("email, used, expires_at, buyer_name, buyer_phone")
    .eq("token", token)
    .maybeSingle();

  if (!data) return { error: "Link inválido ou expirado." };
  if (data.used) return { error: "Este link já foi utilizado. Faça login normalmente." };
  if (new Date(data.expires_at) < new Date()) return { error: "Este link expirou. Entre em contato com o suporte." };

  return {
    email: data.email,
    defaultName: (data as { buyer_name?: string }).buyer_name ?? undefined,
    defaultPhone: (data as { buyer_phone?: string }).buyer_phone ?? undefined,
  };
}

export async function activateAccount(
  formData: FormData
): Promise<ActivateResult> {
  const raw = {
    token: formData.get("token"),
    full_name: formData.get("full_name"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
    phone: formData.get("phone") ?? "",
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

  // Verifica se já tem conta (comparação case-insensitive)
  const { data: existing } = await service.auth.admin.listUsers();
  const emailLower = email.toLowerCase();
  const alreadyExists = existing?.users?.some(
    (u) => u.email?.toLowerCase() === emailLower
  );

  if (alreadyExists) {
    // Conta já existe — concede a matrícula pendente e marca token como usado
    const existingUser = existing.users.find(
      (u) => u.email?.toLowerCase() === emailLower
    );
    if (existingUser && tokenRow.course_id) {
      await service.from("enrollments").upsert(
        { user_id: existingUser.id, course_id: tokenRow.course_id, source: "payt", granted_at: new Date().toISOString(), expires_at: null },
        { onConflict: "user_id,course_id" }
      );
    }
    await service.from("activation_tokens").update({ used: true }).eq("token", parsed.data.token);
    return { error: "Você já possui uma conta com este e-mail. Faça login para acessar seu curso." };
  }

  // Cria conta no Supabase Auth (email_confirm: true — fluxo de ativação substitui verificação)
  const { data: created, error: signUpError } = await service.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (signUpError || !created?.user) {
    return { error: "Erro ao criar conta. Tente novamente ou entre em contato com o suporte." };
  }

  const userId = created.user.id;

  // Monta atualização do perfil
  const profileUpdate: Record<string, string> = {
    full_name: parsed.data.full_name,
  };
  if (parsed.data.phone) profileUpdate.phone = parsed.data.phone;
  if (parsed.data.date_of_birth) profileUpdate.date_of_birth = parsed.data.date_of_birth;

  // Busca CPF e telefone do Payt (payment_events pelo e-mail)
  const { data: paymentEvent } = await service
    .from("payment_events")
    .select("payload")
    .eq("buyer_email", email)
    .eq("processed", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentEvent?.payload) {
    const payload = paymentEvent.payload as Record<string, unknown>;
    const customer = payload.customer as Record<string, string> | undefined;

    // CPF do Payt — criptografar antes de salvar
    const rawCpf = customer?.doc?.replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11) {
      try {
        profileUpdate.cpf_encrypted = encryptCpf(rawCpf);
        profileUpdate.cpf_hash = hashCpf(rawCpf);
      } catch {
        console.warn("[activate] CPF não criptografado — CERTIFICATE_ENCRYPTION_KEY ausente?");
      }
    }

    // Telefone do Payt — só usa se a aluna não preencheu o campo
    if (!parsed.data.phone && customer?.phone) {
      profileUpdate.phone = customer.phone;
    }
  }

  await service.from("profiles").update(profileUpdate).eq("id", userId);

  // Concede matrícula pendente
  if (tokenRow.course_id) {
    await service.from("enrollments").upsert(
      {
        user_id: userId,
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
  sendWelcomeEmail({
    to: email,
    studentName: parsed.data.full_name,
  }).catch((e) => console.error("[activate] welcome email:", e));

  return { success: true };
}
