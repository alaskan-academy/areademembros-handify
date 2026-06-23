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
import { encryptCpf } from "@/lib/cpf-crypto";

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

    const phone = formData.get("phone") as string | null;
    if (phone?.trim()) profileUpdate.phone = phone.trim();

    const rawCpf = (formData.get("cpf") as string | null)?.replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11) {
      try {
        profileUpdate.cpf_encrypted = encryptCpf(rawCpf);
      } catch {
        console.warn("[cadastro] CPF não criptografado — CERTIFICATE_ENCRYPTION_KEY ausente?");
      }
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

export async function recuperarSenhaAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = { email: formData.get("email") };
  const parsed = recuperarSenhaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/nova-senha`,
  });

  if (error) {
    return { error: "Erro ao enviar e-mail. Tente novamente." };
  }

  return {
    success: "Se este e-mail estiver cadastrado, você receberá as instruções.",
  };
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
