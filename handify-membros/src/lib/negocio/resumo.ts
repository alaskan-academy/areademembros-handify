import "server-only";
import { createClient } from "@/lib/supabase/server";
import { situacao } from "@/lib/estoque/tipos";
import { proximasDatas, prazosPara, produzPorCategorias } from "@/lib/calendario/datas";

/**
 * "Meu negócio" — o resumo no topo de Ferramentas para quem tem o Completo:
 * pedidos em aberto, a receber, insumos acabando, próxima data, receitas e
 * catálogo. Lê com o cliente da própria aluna (RLS), tudo em paralelo.
 */

export type ResumoNegocio = {
  pedidosAbertos: number;
  totalAbertos: number;
  aReceber: number;
  atrasados: number;
  entregasSemana: number;
  insumosAcabando: number;
  insumosVencendo: number;
  receitas: number;
  produtos: number;
  proximaData: { nome: string; emoji: string; data: string; produzirAte: string; dias: number } | null;
  /** Ela já usa alguma ferramenta do Completo? Sem nada, o bloco não aparece. */
  temAlgo: boolean;
};

function hojeISO(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DIA = 86400000;
function diffDias(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA);
}

export async function resumoMeuNegocio(userId: string, categorias: string[]): Promise<ResumoNegocio> {
  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ data: orders }, { data: items }, { data: supplies }, receitas, produtos, { data: eventos }] = await Promise.all([
    supabase.from("orders").select("id, status, due_date, paid_amount").eq("user_id", userId),
    supabase.from("order_items").select("order_id, quantity, unit_price").eq("user_id", userId),
    supabase.from("supplies").select("quantity, min_quantity, expires_at").eq("user_id", userId),
    supabase.from("recipes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("catalog_items").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
    supabase.from("calendar_events").select("title, date").eq("user_id", userId).gte("date", hoje).order("date").limit(1),
  ]);

  const totalPorPedido = new Map<string, number>();
  for (const i of items ?? []) {
    totalPorPedido.set(i.order_id as string, (totalPorPedido.get(i.order_id as string) ?? 0) + Number(i.quantity) * Number(i.unit_price));
  }
  let pedidosAbertos = 0, totalAbertos = 0, aReceber = 0, atrasados = 0, entregasSemana = 0;
  for (const o of orders ?? []) {
    const total = totalPorPedido.get(o.id as string) ?? 0;
    aReceber += Math.max(0, total - Number(o.paid_amount));
    if (o.status === "entregue") continue;
    pedidosAbertos += 1;
    totalAbertos += total;
    if (o.due_date) {
      const d = diffDias(hoje, o.due_date as string);
      if (d < 0) atrasados += 1;
      else if (d <= 7) entregasSemana += 1;
    }
  }

  let insumosAcabando = 0, insumosVencendo = 0;
  for (const s of supplies ?? []) {
    const st = situacao({ quantity: Number(s.quantity), min_quantity: s.min_quantity == null ? null : Number(s.min_quantity), expires_at: (s.expires_at as string | null) ?? null });
    if (st.acabando) insumosAcabando += 1;
    if (st.validade) insumosVencendo += 1;
  }

  // Próxima data: a comercial mais perto ou a dela, o que vier primeiro.
  const produz = produzPorCategorias(categorias);
  const comercial = proximasDatas(hoje, produz)[0];
  const minha = eventos?.[0];
  let proximaData: ResumoNegocio["proximaData"] = null;
  const escolhida = minha && (!comercial || (minha.date as string) < comercial.data) ? { nome: minha.title as string, emoji: "📌", data: minha.date as string } : comercial ? { nome: comercial.nome, emoji: comercial.emoji, data: comercial.data } : null;
  if (escolhida) {
    const prazos = prazosPara(escolhida.data, produz, false);
    proximaData = { ...escolhida, produzirAte: prazos.produzirAte, dias: diffDias(hoje, escolhida.data) };
  }

  const r: ResumoNegocio = {
    pedidosAbertos,
    totalAbertos: Math.round(totalAbertos * 100) / 100,
    aReceber: Math.round(aReceber * 100) / 100,
    atrasados,
    entregasSemana,
    insumosAcabando,
    insumosVencendo,
    receitas: receitas.count ?? 0,
    produtos: produtos.count ?? 0,
    proximaData,
    temAlgo: false,
  };
  r.temAlgo = (orders?.length ?? 0) > 0 || (supplies?.length ?? 0) > 0 || r.receitas > 0 || r.produtos > 0 || (eventos?.length ?? 0) > 0;
  return r;
}
