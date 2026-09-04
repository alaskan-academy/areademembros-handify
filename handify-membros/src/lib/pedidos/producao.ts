"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/access";

/**
 * Pedidos → Produzir: soma o que está em aberto, escala a receita ligada a
 * cada produto do catálogo e confere contra o estoque — "faltam 400 g de base".
 * Só leitura; a baixa continua na ficha da receita, quando ela produzir.
 */

export type PlanoProducao = {
  produtos: { nome: string; quantidade: number; temReceita: boolean }[];
  insumos: { nome: string; precisa: number; unidade: string; tem: number | null; falta: number; estoqueId: string | null }[];
  semReceita: string[];
  pedidos: number;
};

type ReceitaData = { unidades?: string; insumos?: { nome?: string; unidade?: string; qtdUsadaNoLote?: string; estoqueId?: string }[] };

const n = (s: unknown) => Math.max(0, parseFloat(String(s ?? "").replace(",", ".")) || 0);
const fator = (de: string, para: string) =>
  de === para ? 1 : (de === "kg" && para === "g") || (de === "L" && para === "mL") ? 1000 : (de === "g" && para === "kg") || (de === "mL" && para === "L") ? 0.001 : 1;

export async function planoDeProducao(): Promise<PlanoProducao> {
  const vazio: PlanoProducao = { produtos: [], insumos: [], semReceita: [], pedidos: 0 };
  const { userId } = await getViewer();
  if (!userId) return vazio;
  const supabase = await createClient();

  const { data: abertos } = await supabase.from("orders").select("id").eq("user_id", userId).eq("status", "a_fazer");
  const ids = (abertos ?? []).map((o) => o.id as string);
  if (ids.length === 0) return vazio;

  const [{ data: itens }, { data: catalogo }, { data: estoque }] = await Promise.all([
    supabase.from("order_items").select("catalog_item_id, name, quantity").in("order_id", ids),
    supabase.from("catalog_items").select("id, name, recipe_id").eq("user_id", userId),
    supabase.from("supplies").select("id, name, quantity, unit").eq("user_id", userId),
  ]);

  // Soma por produto (do catálogo pelo id; digitado pelo nome).
  const porProduto = new Map<string, { nome: string; quantidade: number; recipeId: string | null }>();
  for (const i of itens ?? []) {
    const cat = i.catalog_item_id ? (catalogo ?? []).find((c) => c.id === i.catalog_item_id) : null;
    const chave = cat ? `c:${cat.id}` : `n:${(i.name as string).trim().toLowerCase()}`;
    const atual = porProduto.get(chave) ?? { nome: (cat?.name as string) ?? (i.name as string), quantidade: 0, recipeId: (cat?.recipe_id as string | null) ?? null };
    atual.quantidade += Number(i.quantity);
    porProduto.set(chave, atual);
  }

  const recipeIds = [...new Set([...porProduto.values()].map((p) => p.recipeId).filter((x): x is string => !!x))];
  const { data: receitas } = recipeIds.length ? await supabase.from("recipes").select("id, units, data").in("id", recipeIds) : { data: [] as { id: string; units: number; data: ReceitaData }[] };

  // Escala cada receita para a quantidade pedida e soma os insumos.
  const necessarios = new Map<string, { nome: string; precisa: number; unidade: string; estoqueId: string | null }>();
  const semReceita: string[] = [];
  const produtos: PlanoProducao["produtos"] = [];
  for (const p of porProduto.values()) {
    const receita = p.recipeId ? (receitas ?? []).find((r) => r.id === p.recipeId) : null;
    const data = receita?.data as ReceitaData | undefined;
    const unidadesReceita = n(data?.unidades) || Number(receita?.units ?? 0);
    const temReceita = !!data?.insumos?.length && unidadesReceita > 0;
    produtos.push({ nome: p.nome, quantidade: p.quantidade, temReceita });
    if (!temReceita) { semReceita.push(p.nome); continue; }
    const escala = p.quantidade / unidadesReceita;
    for (const ins of data!.insumos!) {
      const nome = (ins.nome ?? "").trim();
      const qtd = n(ins.qtdUsadaNoLote) * escala;
      if (!nome || qtd <= 0) continue;
      const unidade = ins.unidade ?? "g";
      const chave = ins.estoqueId ?? `${nome.toLowerCase()}|${unidade}`;
      const atual = necessarios.get(chave) ?? { nome, precisa: 0, unidade, estoqueId: ins.estoqueId ?? null };
      atual.precisa += qtd;
      necessarios.set(chave, atual);
    }
  }

  // Confere contra o estoque: pelo id ligado ou, sem ligação, pelo nome.
  const insumos = [...necessarios.values()].map((i) => {
    const e = (estoque ?? []).find((s) => (i.estoqueId ? s.id === i.estoqueId : (s.name as string).trim().toLowerCase() === i.nome.toLowerCase()));
    const tem = e ? Number(e.quantity) * fator(e.unit as string, i.unidade) : null;
    const precisa = Math.round(i.precisa * 100) / 100;
    return { nome: i.nome, precisa, unidade: i.unidade, tem: tem == null ? null : Math.round(tem * 100) / 100, falta: tem == null ? 0 : Math.max(0, Math.round((precisa - tem) * 100) / 100), estoqueId: e ? (e.id as string) : null };
  }).sort((a, b) => (b.falta - a.falta) || a.nome.localeCompare(b.nome, "pt-BR"));

  return { produtos, insumos, semReceita, pedidos: ids.length };
}
