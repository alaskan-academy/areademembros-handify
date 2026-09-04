import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { gerarCatalogoPdf } from "@/lib/catalogo/pdf";
import type { Marca } from "@/lib/catalogo/actions";

/**
 * A tabela de preços dela em PDF. `/api/*` passa pelo proxy sem login, então a
 * checagem é aqui: sem sessão, 401. Gerar o PDF é "ler o que é dela" — vale
 * mesmo com o plano vencido (nunca some, só congela); o que exige o plano é
 * editar, e isso fica nas actions.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await getViewer();
  if (!userId) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });

  const supabase = await createClient();
  const [{ data: marca }, { data: itens }] = await Promise.all([
    supabase.from("business_profile").select("brand_name, tagline, whatsapp, instagram, city").eq("user_id", userId).maybeSingle(),
    supabase
      .from("catalog_items")
      .select("name, description, price")
      .eq("user_id", userId)
      .eq("active", true)
      .order("position")
      .order("created_at"),
  ]);

  const m: Marca = (marca as Marca | null) ?? { brand_name: "", tagline: null, whatsapp: null, instagram: null, city: null };
  const pdf = await gerarCatalogoPdf(
    m,
    (itens ?? []).map((i) => ({ name: i.name as string, description: (i.description as string | null) ?? null, price: Number(i.price) }))
  );

  const nome = (m.brand_name || "tabela-de-precos")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="tabela-de-precos-${nome || "catalogo"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
