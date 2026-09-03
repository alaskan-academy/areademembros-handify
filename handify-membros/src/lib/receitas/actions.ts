"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, hasActiveMembership } from "@/lib/auth/access";

/**
 * Minhas receitas — a ficha de "Minha receita" guardada na conta.
 *
 * Usa o cliente da própria aluna, então o RLS de `recipes` vale: ela sempre
 * lê o que é dela; escrever exige Handify Completo ativo. A checagem aqui é
 * só para a mensagem ser dela ("seu plano venceu"), não o erro cru do banco.
 */

export type ReceitaResumo = {
  id: string;
  name: string;
  product: "sabonetes" | "velas";
  units: number;
  unit_weight: number | null;
  cost_per_unit: number | null;
  price: number | null;
  margin: number | null;
  aroma: string | null;
  wick: string | null;
  updated_at: string;
};

const resumoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Dê um nome à receita").max(80),
  product: z.enum(["sabonetes", "velas"]),
  units: z.number().int().min(0).max(100000),
  unit_weight: z.number().min(0).max(1000000).nullable(),
  cost_per_unit: z.number().min(0).max(1000000).nullable(),
  price: z.number().min(0).max(1000000).nullable(),
  margin: z.number().int().min(0).max(100).nullable(),
  aroma: z.string().max(200).nullable(),
  wick: z.string().max(200).nullable(),
  data: z.unknown(),
});

async function podeEscrever(): Promise<{ userId: string | null; ok: boolean }> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return { userId: null, ok: false };
  if (isAdmin) return { userId, ok: true };
  return { userId, ok: await hasActiveMembership(userId) };
}

export async function salvarReceita(
  input: z.input<typeof resumoSchema>
): Promise<{ id?: string; error?: string }> {
  const parsed = resumoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta para guardar." };
  if (!ok) return { error: "Guardar na conta faz parte do Handify Completo. Suas receitas guardadas continuam aqui — renove para criar e editar." };

  // O formulário inteiro cabe em poucos KB; um limite evita abuso.
  const json = JSON.stringify(parsed.data.data ?? {});
  if (json.length > 60_000) return { error: "Essa receita ficou grande demais para guardar." };

  const supabase = await createClient();
  const { id, ...resumo } = parsed.data;
  const linha = { ...resumo, data: JSON.parse(json) as unknown, user_id: userId, updated_at: new Date().toISOString() };

  if (id) {
    const { error } = await supabase.from("recipes").update(linha).eq("id", id).eq("user_id", userId);
    if (error) return { error: `Não deu para guardar: ${error.message}` };
    revalidatePath("/ferramentas/minhas-receitas");
    return { id };
  }

  const { data: criada, error } = await supabase.from("recipes").insert(linha).select("id").single();
  if (error || !criada) return { error: `Não deu para guardar: ${error?.message ?? "sem retorno"}` };
  revalidatePath("/ferramentas/minhas-receitas");
  return { id: criada.id as string };
}

export async function listarReceitas(): Promise<{ receitas: ReceitaResumo[]; podeEditar: boolean }> {
  const { userId, ok } = await podeEscrever();
  if (!userId) return { receitas: [], podeEditar: false };
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("id, name, product, units, unit_weight, cost_per_unit, price, margin, aroma, wick, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return { receitas: (data ?? []) as ReceitaResumo[], podeEditar: ok };
}

export async function carregarReceita(id: string): Promise<{ id: string; data: unknown } | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { userId } = await getViewer();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("id, data").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? { id: data.id as string, data: data.data } : null;
}

export async function excluirReceita(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Receita inválida." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: "Com o plano vencido a receita fica guardada — não dá para apagar nem editar até renovar." };
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para apagar: ${error.message}` };
  revalidatePath("/ferramentas/minhas-receitas");
  return {};
}
