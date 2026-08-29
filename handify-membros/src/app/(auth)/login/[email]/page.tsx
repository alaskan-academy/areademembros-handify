import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Link direto de login com e-mail embutido: `/login/aluna@email.com`.
 *
 * Serve para mandar por WhatsApp — a aluna clica e já cai na tela certa,
 * sem digitar o e-mail. Espelha o `/cadastro/[email]`, que faz o caminho
 * inverso (conta existente → login).
 *
 * - Já logada           → /cursos
 * - Tem conta           → /login com o e-mail preenchido
 * - Ainda não tem conta → /cadastro/[email] para criar
 */
export default async function LoginComEmailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: encodedEmail } = await params;

  // Um `%` solto na URL faz o decode estourar — nesse caso usa o valor cru.
  let email: string;
  try {
    email = decodeURIComponent(encodedEmail).trim();
  } catch {
    email = encodedEmail.trim();
  }

  // Já está logada → vai direto para os cursos
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/cursos");

  // E-mail malformado no link → login normal, sem pré-preencher
  if (!email.includes("@")) redirect("/login");

  // `ilike` porque o e-mail pode vir com maiúsculas no link
  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  // Sem conta ainda → cadastro, senão cairia numa tela de login inútil
  if (!existing) redirect(`/cadastro/${encodeURIComponent(email)}`);

  redirect(`/login?email=${encodeURIComponent(email)}`);
}
