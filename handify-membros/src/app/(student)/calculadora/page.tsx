import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Calculadora de Custo e Lucro — Handify" };

export default async function CalculadoraPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const src = `https://custoelucro.handify.com.br/?email=${encodeURIComponent(user.email ?? "")}`;

  return (
    <div className="w-full" style={{ height: "calc(100svh - 104px)" }}>
      <iframe
        src={src}
        title="Calculadora de Custo e Lucro — Handify"
        className="w-full h-full border-0 block"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
