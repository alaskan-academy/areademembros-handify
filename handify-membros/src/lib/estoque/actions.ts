"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, hasActiveMembership } from "@/lib/auth/access";

/**
 * Estoque de insumos — quanto tem de cada material, o que está acabando, o
 * que vence. Usa o cliente da própria aluna: o RLS garante que ela lê o que é
 * dela e que escrever exige Handify Completo ativo ("nunca some, só congela").
 */

import { CATEGORIAS, UNIDADES, type Categoria, type Unidade } from "./tipos";

export type Insumo = {
  id: string;
  name: string;
  category: Categoria;
  quantity: number;
  unit: Unidade;
  min_quantity: number | null;
  expires_at: string | null;
  cost: number | null;
  cost_quantity: number | null;
  supplier: string | null;
  notes: string | null;
  updated_at: string;
};

const insumoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome ao insumo").max(80),
  category: z.enum(CATEGORIAS).default("outros"),
  quantity: z.number().min(0, "Quantidade não pode ser negativa").max(1000000000),
  unit: z.enum(UNIDADES).default("g"),
  min_quantity: z.number().min(0).max(1000000000).nullable().optional(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable().optional(),
  cost: z.number().min(0).max(100000000).nullable().optional(),
  cost_quantity: z.number().positive("Por quanto? Precisa ser mais que zero").max(1000000000).nullable().optional(),
  supplier: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

const MSG_SEM_PLANO = "O estoque faz parte do Handify Completo. O que você já anotou continua aqui — renove para mexer.";

async function podeEscrever(): Promise<{ userId: string | null; ok: boolean }> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return { userId: null, ok: false };
  if (isAdmin) return { userId, ok: true };
  return { userId, ok: await hasActiveMembership(userId) };
}

function linha(r: Record<string, unknown>): Insumo {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as Categoria,
    quantity: Number(r.quantity),
    unit: r.unit as Unidade,
    min_quantity: r.min_quantity == null ? null : Number(r.min_quantity),
    expires_at: (r.expires_at as string | null) ?? null,
    cost: r.cost == null ? null : Number(r.cost),
    cost_quantity: r.cost_quantity == null ? null : Number(r.cost_quantity),
    supplier: (r.supplier as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    updated_at: r.updated_at as string,
  };
}

const CAMPOS = "id, name, category, quantity, unit, min_quantity, expires_at, cost, cost_quantity, supplier, notes, updated_at";

export async function listarEstoque(): Promise<{ insumos: Insumo[]; podeEditar: boolean }> {
  const { userId, ok } = await podeEscrever();
  if (!userId) return { insumos: [], podeEditar: false };
  const supabase = await createClient();
  const { data } = await supabase.from("supplies").select(CAMPOS).eq("user_id", userId).order("name");
  return { insumos: ((data ?? []) as Record<string, unknown>[]).map(linha), podeEditar: ok };
}

/** Para a ferramenta de Validade: os insumos que têm data — "o que vence primeiro manda". */
export async function listarInsumosComValidade(): Promise<{ nome: string; validade: string }[]> {
  const { userId } = await getViewer();
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("supplies").select("name, expires_at").eq("user_id", userId).not("expires_at", "is", null).order("expires_at");
  return (data ?? []).map((r) => ({ nome: r.name as string, validade: r.expires_at as string }));
}

export async function salvarInsumo(input: z.input<typeof insumoSchema>): Promise<{ insumo?: Insumo; error?: string }> {
  const parsed = insumoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { id, ...d } = parsed.data;
  const valores = {
    user_id: userId,
    name: d.name,
    category: d.category,
    quantity: Math.round(d.quantity * 1000) / 1000,
    unit: d.unit,
    min_quantity: d.min_quantity ?? null,
    expires_at: d.expires_at ?? null,
    cost: d.cost ?? null,
    cost_quantity: d.cost_quantity ?? null,
    supplier: d.supplier || null,
    notes: d.notes || null,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("supplies").update(valores).eq("id", id).eq("user_id", userId).select(CAMPOS).single()
    : supabase.from("supplies").insert(valores).select(CAMPOS).single();
  const { data, error } = await query;
  if (error || !data) return { error: `Não deu para salvar: ${error?.message ?? "sem retorno"}` };
  revalidatePath("/ferramentas/estoque");
  revalidatePath("/ferramentas");
  return { insumo: linha(data as Record<string, unknown>) };
}

/** "Usei 200 g" (negativo) ou "Comprei 1 kg" (positivo). Nunca fica abaixo de zero. */
export async function moverInsumo(id: string, delta: number): Promise<{ quantity?: number; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Insumo inválido." };
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000000000) return { error: "Quantidade inválida." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { data: atual } = await supabase.from("supplies").select("quantity").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!atual) return { error: "Insumo não encontrado." };
  const nova = Math.max(0, Math.round((Number(atual.quantity) + delta) * 1000) / 1000);
  const { error } = await supabase.from("supplies").update({ quantity: nova, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para atualizar: ${error.message}` };
  revalidatePath("/ferramentas/estoque");
  revalidatePath("/ferramentas");
  return { quantity: nova };
}

export async function excluirInsumo(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Insumo inválido." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { error } = await supabase.from("supplies").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para apagar: ${error.message}` };
  revalidatePath("/ferramentas/estoque");
  revalidatePath("/ferramentas");
  return {};
}
