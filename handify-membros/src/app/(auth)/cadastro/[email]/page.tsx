import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CadastroEmailForm from "./CadastroEmailForm";

type PaytData = { cpf?: string; phone?: string; defaultName?: string };

async function getPaytData(email: string): Promise<PaytData> {
  try {
    const service = createServiceClient();

    // 1. Prioriza token de ativação (dados diretos da compra mais recente)
    const { data: token } = await service
      .from("activation_tokens")
      .select("buyer_name, buyer_phone, payload:course_id")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fallback: payment_events (lê payload JSON para CPF + phone)
    const { data: event } = await service
      .from("payment_events")
      .select("payload, buyer_name")
      .eq("buyer_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = event?.payload as Record<string, unknown> | undefined;
    const customer = payload?.customer as Record<string, string> | undefined;

    const rawDoc = customer?.doc?.replace(/\D/g, "");
    const cpf = rawDoc?.length === 11
      ? `${rawDoc.slice(0, 3)}.${rawDoc.slice(3, 6)}.${rawDoc.slice(6, 9)}-${rawDoc.slice(9)}`
      : undefined;

    const phone = (token as { buyer_phone?: string } | null)?.buyer_phone
      || customer?.phone
      || undefined;

    const defaultName = (token as { buyer_name?: string } | null)?.buyer_name
      || event?.buyer_name
      || undefined;

    return { cpf, phone, defaultName };
  } catch {
    return {};
  }
}

export default async function CadastroComEmailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: encodedEmail } = await params;
  const email = decodeURIComponent(encodedEmail);

  // Já está logada → dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  // Conta já existe → login com e-mail pré-preenchido
  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) redirect(`/login?email=${encodeURIComponent(email)}`);

  const { cpf: defaultCpf, phone: defaultPhone, defaultName } = await getPaytData(email);

  return (
    <CadastroEmailForm
      email={email}
      defaultCpf={defaultCpf}
      defaultPhone={defaultPhone}
      defaultName={defaultName}
    />
  );
}
