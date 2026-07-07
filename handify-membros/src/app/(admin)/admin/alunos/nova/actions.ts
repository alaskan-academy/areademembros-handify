"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";

const createSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().optional(),
  phone: z.string().max(30).optional(),
  date_of_birth: z.string().optional(),
  cpf: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.replace(/\D/g, "").length === 11,
      "CPF deve ter 11 dígitos"
    ),
});

export async function createStudentAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return { error: "Sem permissão" };

  const rawPassword = ((formData.get("password") as string) ?? "").trim();
  const rawCpf = ((formData.get("cpf") as string) ?? "").replace(/\D/g, "");

  const parsed = createSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: rawPassword || undefined,
    phone: (formData.get("phone") as string)?.trim() || undefined,
    date_of_birth: (formData.get("date_of_birth") as string) || undefined,
    cpf: rawCpf || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (rawPassword && rawPassword.length < 8) {
    return { error: "Senha deve ter ao menos 8 caracteres" };
  }

  const { full_name, email, phone, date_of_birth } = parsed.data;

  const password =
    rawPassword.length >= 8
      ? rawPassword
      : Math.random().toString(36).slice(-10) +
        Math.random().toString(36).slice(-10).toUpperCase() +
        "!1";

  const service = createServiceClient();

  const { data: created, error: authErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authErr) {
    console.error("[createStudent] auth error:", authErr);
    if (authErr.message.includes("already registered")) {
      const { data: existing } = await service
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (existing?.id) redirect(`/admin/alunos/${existing.id}`);
      return { error: "Este e-mail já está cadastrado." };
    }
    return { error: `Erro ao criar aluna: ${authErr.message}` };
  }

  // Aguarda trigger criar o profile
  await new Promise((r) => setTimeout(r, 500));

  // Campos extras além do que o trigger já preenche
  const extras: Record<string, unknown> = {};
  if (phone) extras.phone = phone;
  if (date_of_birth) extras.date_of_birth = date_of_birth;
  if (rawCpf.length === 11) {
    extras.cpf_encrypted = encryptCpf(rawCpf);
    extras.cpf_hash = hashCpf(rawCpf);
  }

  if (Object.keys(extras).length > 0) {
    await service.from("profiles").update(extras).eq("id", created.user.id);
  }

  redirect(`/admin/alunos/${created.user.id}`);
}
