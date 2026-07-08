import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function formatPreco(price: number): string {
  if (price % 1 === 0) return `R$${price.toFixed(0)}`;
  return `R$${price.toFixed(2).replace(".", ",")}`;
}

function formatParcelas(price: number, installments: number | null): string | null {
  if (!installments || installments <= 1) return null;
  const value = price / installments;
  return `${installments}x R$${value.toFixed(2).replace(".", ",")}`;
}

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("courses")
    .select("slug, title, price, price_installments")
    .eq("published", true)
    .order("position", { ascending: true });

  if (error) {
    console.error("[api/public/produtos] db error:", error.message);
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const produtos = (data ?? []).map((c) => ({
    slug: c.slug,
    nome: c.title,
    preco: formatPreco(Number(c.price)),
    parcelas: formatParcelas(Number(c.price), c.price_installments as number | null),
  }));

  return NextResponse.json(
    { produtos },
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
