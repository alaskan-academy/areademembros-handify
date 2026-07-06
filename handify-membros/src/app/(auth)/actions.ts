"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  cadastroSchema,
  recuperarSenhaSchema,
  novaSenhaSchema,
} from "@/lib/validations/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";
import { createServiceClient } from "@/lib/supabase/service";

async function grantPendingEnrollments(email: string, userId: string) {
  const service = createServiceClient();
  const { data: tokens } = await service
    .from("activation_tokens")
    .select("token, course_id")
    .eq("email", email.toLowerCase())
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .not("course_id", "is", null);

  if (!tokens?.length) return;

  for (const t of tokens) {
    if (!t.course_id) continue;
    await service.from("enrollments").upsert(
      { user_id: userId, course_id: t.course_id, source: "payt", granted_at: new Date().toISOString(), expires_at: null },
      { onConflict: "user_id,course_id" }
    );
    await service.from("activation_tokens").update({ used: true }).eq("token", t.token);
  }
  console.info(`[cadastro] ${tokens.length} matrícula(s) pendente(s) concedida(s) para ${email}`);
}

export type ActionResult = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "E-mail ou senha incorretos." };
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "Confirme seu e-mail antes de entrar." };
    }
    return { error: "Erro ao entrar. Tente novamente." };
  }

  redirect("/cursos");
}

export async function cadastroAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  };

  const parsed = cadastroSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/cursos`,
    },
  });

  if (error) {
    console.error("[cadastro] supabase signUp error:", error.message, error.status);
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return { error: "Este e-mail já está cadastrado. Tente fazer login." };
    }
    if (msg.includes("rate limit") || msg.includes("email rate")) {
      return { error: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente." };
    }
    if (msg.includes("password") && msg.includes("weak")) {
      return { fieldErrors: { password: "Senha muito fraca. Use letras, números e símbolos." } };
    }
    if (msg.includes("invalid email")) {
      return { fieldErrors: { email: "E-mail inválido." } };
    }
    return { error: `Erro ao criar conta: ${error.message}` };
  }

  const userId = signUpData?.user?.id;

  if (userId) {
    const profileUpdate: Record<string, string> = {};

    const dateOfBirth = formData.get("date_of_birth") as string | null;
    if (dateOfBirth) profileUpdate.date_of_birth = dateOfBirth;

    const phone = (formData.get("phone") as string | null)?.trim();
    if (phone) profileUpdate.phone = phone;

    const rawCpf = (formData.get("cpf") as string | null)?.replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11) {
      try {
        profileUpdate.cpf_encrypted = encryptCpf(rawCpf);
        profileUpdate.cpf_hash = hashCpf(rawCpf);
      } catch {
        console.warn("[cadastro] CPF não criptografado — CERTIFICATE_ENCRYPTION_KEY ausente?");
      }
    } else if (rawCpf && rawCpf.length !== 11) {
      return { fieldErrors: { cpf: "CPF inválido. Verifique e tente novamente." } };
    }

    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from("profiles").update(profileUpdate).eq("id", userId);
    }

    // Concede matrículas pendentes de compras feitas antes do cadastro
    grantPendingEnrollments(parsed.data.email, userId).catch(
      (e) => console.error("[cadastro] pending enrollments:", e)
    );
  }

  // Dispara boas-vindas em background
  sendWelcomeEmail({ to: parsed.data.email, studentName: parsed.data.full_name }).catch(
    (e) => console.error("[cadastro] welcome email:", e)
  );

  return {
    success: "Conta criada! Verifique seu e-mail para confirmar o acesso.",
  };
}

/** Verifica se o e-mail está cadastrado (sem expor token de reset). */
export async function checkEmailExistsAction(email: string): Promise<boolean> {
  const service = createServiceClient();
  const { data: usersData } = await service.auth.admin.listUsers();
  return (
    usersData?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    ) ?? false
  );
}

export async function recuperarSenhaAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = { email: formData.get("email") };
  const parsed = recuperarSenhaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Verifica se o e-mail existe (service client ignora RLS)
  const exists = await checkEmailExistsAction(parsed.data.email);
  if (!exists) {
    return { error: "Este e-mail não está cadastrado. Verifique e tente novamente." };
  }

  // Retorna "ok" para o client disparar resetPasswordForEmail do browser
  // (PKCE exige que o code_verifier seja gerado no contexto do browser)
  return { success: "email-verified" };
}

export async function novaSenhaAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  };

  const parsed = novaSenhaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("same") || msg.includes("different") || msg.includes("old password")) {
      return { error: "A nova senha não pode ser igual à senha atual. Escolha uma senha diferente." };
    }
    return { error: "Erro ao atualizar senha. O link pode ter expirado." };
  }

  redirect("/login?msg=senha-atualizada");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
