"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

const createSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().optional(),
});

export async function createStudentAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  // Verifica admin
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
  const parsed = createSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: rawPassword || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (rawPassword && rawPassword.length < 8) {
    return { error: "Senha deve ter ao menos 8 caracteres" };
  }

  const { full_name, email } = parsed.data;

  // Senha: usada se fornecida, senão gera aleatória
  const password =
    rawPassword.length >= 8
      ? rawPassword
      : Math.random().toString(36).slice(-10) +
        Math.random().toString(36).slice(-10).toUpperCase() +
        "!1";

  const service = createServiceClient();

  // Cria usuário no Auth (sem exigir confirmação de e-mail)
  const { data: created, error: authErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authErr) {
    console.error("[createStudent] auth error:", authErr);
    if (authErr.message.includes("already registered")) {
      return { error: "Este e-mail já está cadastrado." };
    }
    return { error: `Erro ao criar aluna: ${authErr.message}` };
  }

  // O trigger on_auth_user_created cria o profile automaticamente.
  // Aguardamos até 1s para garantir (em caso de latência do trigger).
  await new Promise((r) => setTimeout(r, 500));

  redirect(`/admin/alunos/${created.user.id}`);
}
