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

export type ActionResult = {
  error?: string;
  success?: string;
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
    return { error: parsed.error.issues[0].message };
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
    if (error.message.includes("already registered")) {
      return { error: "Este e-mail já está cadastrado. Tente fazer login." };
    }
    return { error: "Erro ao criar conta. Tente novamente." };
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
      return { error: "CPF inválido. Verifique e tente novamente." };
    }

    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from("profiles").update(profileUpdate).eq("id", userId);
    }
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
    return { error: "Erro ao atualizar senha. O link pode ter expirado." };
  }

  redirect("/login?msg=senha-atualizada");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
