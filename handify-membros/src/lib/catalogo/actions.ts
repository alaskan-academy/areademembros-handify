"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, hasActiveMembership } from "@/lib/auth/access";

/**
 * Catálogo e tabela de preços — os produtos dela, com a marca dela, num PDF
 * para mandar no WhatsApp. Usa o cliente da própria aluna: o RLS garante que
 * ela lê o que é dela e que escrever exige Handify Completo ativo.
 */

export type Marca = {
  brand_name: string;
  tagline: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
};

export type Produto = {
  id: string;
  recipe_id: string | null;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  position: number;
  /** Da receita ligada, se houver — para mostrar custo e preço sugerido. */
  receita?: { name: string; cost_per_unit: number | null; price: number | null } | null;
};

export type ReceitaOpcao = { id: string; name: string; product: string; price: number | null; cost_per_unit: number | null };

const marcaSchema = z.object({
  brand_name: z.string().trim().max(60),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
});

const produtoSchema = z.object({
  id: z.string().uuid().optional(),
  recipe_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "Dê um nome ao produto").max(80),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  price: z.number().min(0, "Preço não pode ser negativo").max(1000000),
  active: z.boolean().default(true),
});

async function podeEscrever(): Promise<{ userId: string | null; ok: boolean }> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return { userId: null, ok: false };
  if (isAdmin) return { userId, ok: true };
  return { userId, ok: await hasActiveMembership(userId) };
}

const MSG_SEM_PLANO = "Editar o catálogo faz parte do Handify Completo. O que você já tem continua aqui — renove para mexer.";

export async function listarCatalogo(): Promise<{
  marca: Marca;
  produtos: Produto[];
  receitas: ReceitaOpcao[];
  podeEditar: boolean;
}> {
  const vazio = { marca: { brand_name: "", tagline: null, whatsapp: null, instagram: null, city: null }, produtos: [], receitas: [], podeEditar: false };
  const { userId, ok } = await podeEscrever();
  if (!userId) return vazio;
  const supabase = await createClient();

  const [{ data: marca }, { data: itens }, { data: receitas }] = await Promise.all([
    supabase.from("business_profile").select("brand_name, tagline, whatsapp, instagram, city").eq("user_id", userId).maybeSingle(),
    supabase
      .from("catalog_items")
      .select("id, recipe_id, name, description, price, active, position, receita:recipes(name, cost_per_unit, price)")
      .eq("user_id", userId)
      .order("position")
      .order("created_at"),
    supabase.from("recipes").select("id, name, product, price, cost_per_unit").eq("user_id", userId).order("updated_at", { ascending: false }),
  ]);

  const produtos: Produto[] = (itens ?? []).map((i) => {
    const row = i as unknown as Produto & { receita: Produto["receita"] | Produto["receita"][] };
    const receita = Array.isArray(row.receita) ? row.receita[0] ?? null : row.receita ?? null;
    return { ...row, price: Number(row.price), receita };
  });

  return {
    marca: (marca as Marca | null) ?? vazio.marca,
    produtos,
    receitas: ((receitas ?? []) as ReceitaOpcao[]).map((r) => ({
      ...r,
      price: r.price == null ? null : Number(r.price),
      cost_per_unit: r.cost_per_unit == null ? null : Number(r.cost_per_unit),
    })),
    podeEditar: ok,
  };
}

export async function salvarMarca(input: z.input<typeof marcaSchema>): Promise<{ error?: string }> {
  const parsed = marcaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase.from("business_profile").upsert(
    {
      user_id: userId,
      brand_name: d.brand_name,
      tagline: d.tagline || null,
      whatsapp: d.whatsapp || null,
      instagram: d.instagram || null,
      city: d.city || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { error: `Não deu para salvar a marca: ${error.message}` };
  revalidatePath("/ferramentas/catalogo");
  return {};
}

export async function salvarProduto(input: z.input<typeof produtoSchema>): Promise<{ id?: string; error?: string }> {
  const parsed = produtoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { id, ...d } = parsed.data;
  const linha = {
    user_id: userId,
    recipe_id: d.recipe_id ?? null,
    name: d.name,
    description: d.description || null,
    price: Math.round(d.price * 100) / 100,
    active: d.active,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { error } = await supabase.from("catalog_items").update(linha).eq("id", id).eq("user_id", userId);
    if (error) return { error: `Não deu para salvar: ${error.message}` };
    revalidatePath("/ferramentas/catalogo");
    return { id };
  }
  const { count } = await supabase.from("catalog_items").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const { data, error } = await supabase
    .from("catalog_items")
    .insert({ ...linha, position: (count ?? 0) + 1 })
    .select("id")
    .single();
  if (error || !data) return { error: `Não deu para salvar: ${error?.message ?? "sem retorno"}` };
  revalidatePath("/ferramentas/catalogo");
  return { id: data.id as string };
}

export async function excluirProduto(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Produto inválido." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para apagar: ${error.message}` };
  revalidatePath("/ferramentas/catalogo");
  return {};
}
