"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, hasActiveMembership } from "@/lib/auth/access";

/**
 * Pedidos e clientes — quem pediu o que, para quando, e quanto falta receber.
 * Usa o cliente da própria aluna: o RLS garante que ela lê o que é dela e que
 * escrever exige Handify Completo ativo ("nunca some, só congela").
 */

export type StatusPedido = "a_fazer" | "pronto" | "entregue";

export type ItemPedido = {
  id?: string;
  catalog_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
};

export type Pedido = {
  id: string;
  customer_id: string | null;
  cliente: { id: string; name: string; whatsapp: string | null } | null;
  status: StatusPedido;
  due_date: string | null;
  delivered_at: string | null;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  itens: ItemPedido[];
  /** Soma de quantidade × preço dos itens. */
  total: number;
};

export type Cliente = {
  id: string;
  name: string;
  whatsapp: string | null;
  pedidos: number;
  total: number;
  ultimo: string | null;
};

export type ProdutoOpcao = { id: string; name: string; price: number };

const itemSchema = z.object({
  catalog_item_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "Dê um nome ao item").max(120),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(100000),
  unit_price: z.number().min(0, "Preço não pode ser negativo").max(1000000),
});

const pedidoSchema = z.object({
  id: z.string().uuid().optional(),
  cliente: z.object({
    name: z.string().trim().min(1, "Quem fez o pedido?").max(80),
    whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  }),
  status: z.enum(["a_fazer", "pronto", "entregue"]).default("a_fazer"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable().optional(),
  paid_amount: z.number().min(0, "Valor não pode ser negativo").max(10000000).default(0),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  itens: z.array(itemSchema).min(1, "Adicione pelo menos um item").max(50),
});

const patchSchema = z.object({
  status: z.enum(["a_fazer", "pronto", "entregue"]).optional(),
  paid_amount: z.number().min(0).max(10000000).optional(),
});

const MSG_SEM_PLANO = "Pedidos fazem parte do Handify Completo. O que você já anotou continua aqui — renove para mexer.";

async function podeEscrever(): Promise<{ userId: string | null; ok: boolean }> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return { userId: null, ok: false };
  if (isAdmin) return { userId, ok: true };
  return { userId, ok: await hasActiveMembership(userId) };
}

const totalDe = (itens: ItemPedido[]) => Math.round(itens.reduce((s, i) => s + i.quantity * i.unit_price, 0) * 100) / 100;

export async function listarPedidos(): Promise<{
  pedidos: Pedido[];
  clientes: Cliente[];
  produtos: ProdutoOpcao[];
  podeEditar: boolean;
}> {
  const vazio = { pedidos: [], clientes: [], produtos: [], podeEditar: false };
  const { userId, ok } = await podeEscrever();
  if (!userId) return vazio;
  const supabase = await createClient();

  const [{ data: pedidos }, { data: itens }, { data: clientes }, { data: produtos }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, customer_id, status, due_date, delivered_at, paid_amount, notes, created_at")
      .eq("user_id", userId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("order_items").select("id, order_id, catalog_item_id, name, quantity, unit_price").eq("user_id", userId).order("position"),
    supabase.from("customers").select("id, name, whatsapp").eq("user_id", userId).order("name"),
    supabase.from("catalog_items").select("id, name, price").eq("user_id", userId).eq("active", true).order("position"),
  ]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id as string, { id: c.id as string, name: c.name as string, whatsapp: (c.whatsapp as string | null) ?? null }]));
  const itensPorPedido = new Map<string, ItemPedido[]>();
  for (const i of itens ?? []) {
    const lista = itensPorPedido.get(i.order_id as string) ?? [];
    lista.push({
      id: i.id as string,
      catalog_item_id: (i.catalog_item_id as string | null) ?? null,
      name: i.name as string,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    });
    itensPorPedido.set(i.order_id as string, lista);
  }

  const lista: Pedido[] = (pedidos ?? []).map((p) => {
    const its = itensPorPedido.get(p.id as string) ?? [];
    return {
      id: p.id as string,
      customer_id: (p.customer_id as string | null) ?? null,
      cliente: p.customer_id ? porCliente.get(p.customer_id as string) ?? null : null,
      status: p.status as StatusPedido,
      due_date: (p.due_date as string | null) ?? null,
      delivered_at: (p.delivered_at as string | null) ?? null,
      paid_amount: Number(p.paid_amount),
      notes: (p.notes as string | null) ?? null,
      created_at: p.created_at as string,
      itens: its,
      total: totalDe(its),
    };
  });

  const agregados = new Map<string, { pedidos: number; total: number; ultimo: string | null }>();
  for (const p of lista) {
    if (!p.customer_id) continue;
    const a = agregados.get(p.customer_id) ?? { pedidos: 0, total: 0, ultimo: null };
    a.pedidos += 1;
    a.total = Math.round((a.total + p.total) * 100) / 100;
    if (!a.ultimo || p.created_at > a.ultimo) a.ultimo = p.created_at;
    agregados.set(p.customer_id, a);
  }
  const clientesLista: Cliente[] = [...porCliente.values()].map((c) => ({ ...c, ...(agregados.get(c.id) ?? { pedidos: 0, total: 0, ultimo: null }) }));

  return {
    pedidos: lista,
    clientes: clientesLista,
    produtos: (produtos ?? []).map((p) => ({ id: p.id as string, name: p.name as string, price: Number(p.price) })),
    podeEditar: ok,
  };
}

/** Acha (sem diferenciar maiúsculas) ou cria a cliente; atualiza o WhatsApp se veio um novo. */
async function garantirCliente(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, name: string, whatsapp: string) {
  const escapado = name.replace(/[\\%_]/g, (m) => `\\${m}`);
  const { data: existente } = await supabase.from("customers").select("id, name, whatsapp").eq("user_id", userId).ilike("name", escapado).maybeSingle();
  if (existente) {
    if (whatsapp && whatsapp !== existente.whatsapp) {
      await supabase.from("customers").update({ whatsapp, updated_at: new Date().toISOString() }).eq("id", existente.id);
    }
    // Mantém o nome como ela escreveu da primeira vez ("Ana Souza"), mesmo se digitar "ana souza" depois.
    return { id: existente.id as string, name: existente.name as string, whatsapp: whatsapp || ((existente.whatsapp as string | null) ?? null) };
  }
  const { data, error } = await supabase.from("customers").insert({ user_id: userId, name, whatsapp: whatsapp || null }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "sem retorno");
  return { id: data.id as string, name, whatsapp: whatsapp || null };
}

export async function salvarPedido(input: z.input<typeof pedidoSchema>): Promise<{ pedido?: Pedido; error?: string }> {
  const parsed = pedidoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const d = parsed.data;

  let cliente: { id: string; name: string; whatsapp: string | null };
  try {
    cliente = await garantirCliente(supabase, userId, d.cliente.name, d.cliente.whatsapp ?? "");
  } catch (e) {
    return { error: `Não deu para salvar a cliente: ${(e as Error).message}` };
  }

  const agora = new Date().toISOString();
  const linha = {
    user_id: userId,
    customer_id: cliente.id,
    status: d.status,
    due_date: d.due_date ?? null,
    paid_amount: Math.round(d.paid_amount * 100) / 100,
    notes: d.notes || null,
    updated_at: agora,
  };

  let id = d.id;
  let created_at = agora;
  let delivered_at: string | null = null;
  if (id) {
    const { data: atual } = await supabase.from("orders").select("delivered_at, created_at").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!atual) return { error: "Pedido não encontrado." };
    created_at = atual.created_at as string;
    delivered_at = d.status === "entregue" ? ((atual.delivered_at as string | null) ?? agora) : null;
    const { error } = await supabase.from("orders").update({ ...linha, delivered_at }).eq("id", id).eq("user_id", userId);
    if (error) return { error: `Não deu para salvar: ${error.message}` };
    const { error: e2 } = await supabase.from("order_items").delete().eq("order_id", id).eq("user_id", userId);
    if (e2) return { error: `Não deu para atualizar os itens: ${e2.message}` };
  } else {
    delivered_at = d.status === "entregue" ? agora : null;
    const { data, error } = await supabase.from("orders").insert({ ...linha, delivered_at }).select("id").single();
    if (error || !data) return { error: `Não deu para salvar: ${error?.message ?? "sem retorno"}` };
    id = data.id as string;
  }

  const itens = d.itens.map((i, position) => ({
    order_id: id!,
    user_id: userId,
    catalog_item_id: i.catalog_item_id ?? null,
    name: i.name,
    quantity: i.quantity,
    unit_price: Math.round(i.unit_price * 100) / 100,
    position,
  }));
  const { data: salvos, error: e3 } = await supabase.from("order_items").insert(itens).select("id, catalog_item_id, name, quantity, unit_price");
  if (e3) return { error: `Não deu para salvar os itens: ${e3.message}` };

  revalidatePath("/ferramentas/pedidos");
  revalidatePath("/ferramentas");
  const itensFinais: ItemPedido[] = (salvos ?? []).map((i) => ({
    id: i.id as string,
    catalog_item_id: (i.catalog_item_id as string | null) ?? null,
    name: i.name as string,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
  }));
  return {
    pedido: {
      id: id!,
      customer_id: cliente.id,
      cliente: { id: cliente.id, name: cliente.name, whatsapp: cliente.whatsapp },
      status: d.status,
      due_date: d.due_date ?? null,
      delivered_at,
      paid_amount: linha.paid_amount,
      notes: linha.notes,
      created_at,
      itens: itensFinais,
      total: totalDe(itensFinais),
    },
  };
}

/** Atalhos do card: "Ficou pronto", "Entregue", "Recebi tudo". */
export async function atualizarPedido(id: string, patch: z.input<typeof patchSchema>): Promise<{ delivered_at?: string | null; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Pedido inválido." };
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const agora = new Date().toISOString();
  const mudancas: Record<string, unknown> = { updated_at: agora };
  let delivered_at: string | null | undefined;
  if (parsed.data.status) {
    mudancas.status = parsed.data.status;
    delivered_at = parsed.data.status === "entregue" ? agora : null;
    mudancas.delivered_at = delivered_at;
  }
  if (parsed.data.paid_amount != null) mudancas.paid_amount = Math.round(parsed.data.paid_amount * 100) / 100;
  const { error } = await supabase.from("orders").update(mudancas).eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para atualizar: ${error.message}` };
  revalidatePath("/ferramentas/pedidos");
  revalidatePath("/ferramentas");
  return { delivered_at };
}

export async function excluirPedido(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Pedido inválido." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para apagar: ${error.message}` };
  revalidatePath("/ferramentas/pedidos");
  revalidatePath("/ferramentas");
  return {};
}

/** Só apaga cliente sem pedido — os pedidos guardam o histórico dela. */
export async function excluirCliente(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Cliente inválida." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("user_id", userId);
  if ((count ?? 0) > 0) return { error: "Essa cliente tem pedidos. Apague os pedidos primeiro, ou deixe como está — o histórico é dela." };
  const { error } = await supabase.from("customers").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para apagar: ${error.message}` };
  revalidatePath("/ferramentas/pedidos");
  return {};
}
