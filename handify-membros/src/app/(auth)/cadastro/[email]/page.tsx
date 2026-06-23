import { createServiceClient } from "@/lib/supabase/service";
import CadastroEmailForm from "./CadastroEmailForm";

async function getPaytData(email: string): Promise<{ cpf?: string; phone?: string }> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("payment_events")
      .select("payload")
      .eq("buyer_email", email)
      .eq("processed", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.payload) return {};

    const payload = data.payload as Record<string, unknown>;
    const customer = payload.customer as Record<string, string> | undefined;

    const rawDoc = customer?.doc?.replace(/\D/g, "");
    const cpf = rawDoc?.length === 11
      ? `${rawDoc.slice(0, 3)}.${rawDoc.slice(3, 6)}.${rawDoc.slice(6, 9)}-${rawDoc.slice(9)}`
      : undefined;

    const phone = customer?.phone || undefined;

    return { cpf, phone };
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

  const { cpf: defaultCpf, phone: defaultPhone } = await getPaytData(email);

  return (
    <CadastroEmailForm
      email={email}
      defaultCpf={defaultCpf}
      defaultPhone={defaultPhone}
    />
  );
}
