"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";
import { cadastroSchema } from "@/lib/validations/auth";

export type AtivarResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// ─── Passo 1: verifica e-mail ─────────────────────────────────────────────────

export async function checkAtivarEmailAction(
  _prev: AtivarResult,
  formData: FormData
): Promise<AtivarResult> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";

  if (!email || !email.includes("@")) {
    return { error: "Digite um e-mail válido." };
  }

  const service = createServiceClient();

  // 1. Verifica se existe na tabela de candidatas
  const { data: candidate } = await service
    .from("migration_candidates")
    .select("id, activated_at")
    .eq("email", email)
    .maybeSingle();

  if (!candidate) {
    return {
      error:
        "Este e-mail não está na nossa base de compradores. Verifique se usou o mesmo e-mail da compra. Dúvidas? Entre em contato com o suporte.",
    };
  }

  // 2. Já ativou — redireciona para login
  if (candidate.activated_at) {
    redirect(`/login?msg=ja-tem-conta`);
  }

  // 3. Já tem conta no Supabase Auth (cadastrou por fora)
  const { data: authUsers } = await service.auth.admin.listUsers();
  const existingUser = authUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email
  );

  if (existingUser) {
    // Concede matrículas pendentes e manda para login
    await grantMigrationEnrollments(existingUser.id, email, service);
    await service
      .from("migration_candidates")
      .update({ activated_at: new Date().toISOString() })
      .eq("email", email);
    redirect(`/login?msg=acesso-liberado`);
  }

  // 4. Tudo ok — gera token de 6 caracteres e redireciona para Passo 2
  const token = generateToken();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  await service
    .from("migration_candidates")
    .update({ token, token_expires: expires })
    .eq("email", email);

  redirect(`/ativar/completar?t=${token}`);
}

// ─── Passo 2: completa o cadastro ────────────────────────────────────────────

export async function completarAtivarAction(
  _prev: AtivarResult,
  formData: FormData
): Promise<AtivarResult> {
  const token = (formData.get("token") as string | null)?.trim() ?? "";

  if (!token) {
    return { error: "Link inválido. Volte para a página inicial e tente novamente." };
  }

  const service = createServiceClient();

  // Valida token
  const { data: candidate } = await service
    .from("migration_candidates")
    .select("id, email, full_name, cpf_raw, phone, product_codes, token_expires, activated_at")
    .eq("token", token)
    .maybeSingle();

  if (!candidate) {
    return { error: "Link inválido ou expirado. Volte e tente com seu e-mail novamente." };
  }

  if (candidate.activated_at) {
    redirect(`/login?msg=ja-tem-conta`);
  }

  const expires = candidate.token_expires ? new Date(candidate.token_expires) : null;
  if (!expires || expires < new Date()) {
    return { error: "Este link expirou (válido por 30 minutos). Volte e solicite um novo." };
  }

  // Valida formulário com o mesmo schema do cadastro normal
  const raw = {
    full_name: formData.get("full_name"),
    email: candidate.email,
    phone: (formData.get("phone") as string | null)?.trim() ?? "",
    cpf: (formData.get("cpf") as string | null) ?? "",
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

  // Verifica conflito de CPF
  const rawCpf = parsed.data.cpf.replace(/\D/g, "");
  const cpfHash = hashCpf(rawCpf);

  const { data: cpfConflict } = await service
    .from("profiles")
    .select("id")
    .eq("cpf_hash", cpfHash)
    .maybeSingle();

  if (cpfConflict) {
    return {
      error: "Este CPF já está vinculado a outra conta. Entre em contato com o suporte.",
    };
  }

  // Cria conta (email já confirmado — não exige verificação)
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: candidate.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return { error: "Este e-mail já está cadastrado. Tente fazer login." };
    }
    return { error: "Erro ao criar conta. Tente novamente ou entre em contato com o suporte." };
  }

  const userId = created?.user?.id;
  if (!userId) {
    return { error: "Erro inesperado ao criar conta. Tente novamente." };
  }

  // Atualiza perfil
  const profileUpdate: Record<string, string> = {};
  const dateOfBirth = formData.get("date_of_birth") as string | null;
  if (dateOfBirth) profileUpdate.date_of_birth = dateOfBirth;
  if (parsed.data.phone) profileUpdate.phone = parsed.data.phone;
  try {
    profileUpdate.cpf_encrypted = encryptCpf(rawCpf);
    profileUpdate.cpf_hash = cpfHash;
  } catch {
    console.warn("[ativar] CPF não criptografado — CERTIFICATE_ENCRYPTION_KEY ausente?");
  }

  if (Object.keys(profileUpdate).length > 0) {
    await service.from("profiles").update(profileUpdate).eq("id", userId);
  }

  // Concede matrículas
  await grantMigrationEnrollments(userId, candidate.email, service, candidate.product_codes ?? []);

  // Limpa dados sensíveis e marca como ativada
  await service
    .from("migration_candidates")
    .update({
      cpf_raw: null,
      token: null,
      activated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id);

  // Auto-login
  const authClient = await createClient();
  await authClient.auth.signInWithPassword({
    email: candidate.email,
    password: parsed.data.password,
  });

  redirect("/cursos?migrada=1");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para evitar confusão
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

async function grantMigrationEnrollments(
  userId: string,
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  productCodes?: string[]
) {
  // Se não veio product_codes, busca da tabela
  let codes = productCodes;
  if (!codes) {
    const { data } = await service
      .from("migration_candidates")
      .select("product_codes")
      .eq("email", email)
      .maybeSingle();
    codes = data?.product_codes ?? [];
  }

  if (!codes?.length) return;

  // Busca course_ids pelos product_codes
  const { data: courses } = await service
    .from("courses")
    .select("id, product_codes")
    .overlaps("product_codes", codes);

  if (!courses?.length) return;

  const now = new Date().toISOString();
  const enrollments = courses.map((c: { id: string }) => ({
    user_id: userId,
    course_id: c.id,
    source: "migration",
    granted_at: now,
    expires_at: null,
  }));

  await service
    .from("enrollments")
    .upsert(enrollments, { onConflict: "user_id,course_id" });

  console.info(`[ativar] ${enrollments.length} matrícula(s) concedida(s) para ${email}`);
}
