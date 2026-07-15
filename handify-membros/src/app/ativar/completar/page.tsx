import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import CompletarAtivarForm from "./CompletarAtivarForm";

interface Props {
  searchParams: Promise<{ t?: string }>;
}

export default async function CompletarAtivarPage({ searchParams }: Props) {
  const { t: token } = await searchParams;

  if (!token) {
    redirect("/ativar");
  }

  const service = createServiceClient();

  const { data: candidate } = await service
    .from("migration_candidates")
    .select("email, full_name, cpf_raw, phone, token_expires, activated_at")
    .eq("token", token)
    .maybeSingle();

  // Token inválido ou expirado → volta para o Passo 1
  if (!candidate) {
    redirect("/ativar?erro=token-invalido");
  }

  if (candidate.activated_at) {
    redirect("/login?msg=ja-tem-conta");
  }

  const expires = candidate.token_expires ? new Date(candidate.token_expires) : null;
  if (!expires || expires < new Date()) {
    redirect("/ativar?erro=token-expirado");
  }

  return (
    <CompletarAtivarForm
      token={token}
      email={candidate.email}
      fullName={candidate.full_name ?? ""}
      cpf={candidate.cpf_raw ?? ""}
      phone={candidate.phone ?? ""}
    />
  );
}
