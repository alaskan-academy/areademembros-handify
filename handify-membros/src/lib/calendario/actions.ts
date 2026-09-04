"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, hasActiveMembership } from "@/lib/auth/access";

/**
 * As datas dela no Calendário (feira, encomenda grande). As datas comerciais
 * são calculadas em `datas.ts`. RLS: ela sempre lê; escrever exige Completo.
 */

export type Evento = { id: string; title: string; date: string; notes: string | null };

const eventoSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Dê um nome à data").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

const MSG_SEM_PLANO = "Guardar datas faz parte do Handify Completo. As que você já anotou continuam aqui — renove para mexer.";

async function podeEscrever(): Promise<{ userId: string | null; ok: boolean }> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return { userId: null, ok: false };
  if (isAdmin) return { userId, ok: true };
  return { userId, ok: await hasActiveMembership(userId) };
}

export async function listarEventos(): Promise<{ eventos: Evento[]; podeEditar: boolean }> {
  const { userId, ok } = await podeEscrever();
  if (!userId) return { eventos: [], podeEditar: false };
  const supabase = await createClient();
  const { data } = await supabase.from("calendar_events").select("id, title, date, notes").eq("user_id", userId).order("date");
  return { eventos: (data ?? []).map((e) => ({ id: e.id as string, title: e.title as string, date: e.date as string, notes: (e.notes as string | null) ?? null })), podeEditar: ok };
}

export async function salvarEvento(input: z.input<typeof eventoSchema>): Promise<{ evento?: Evento; error?: string }> {
  const parsed = eventoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { id, ...d } = parsed.data;
  const valores = { user_id: userId, title: d.title, date: d.date, notes: d.notes || null };
  const q = id
    ? supabase.from("calendar_events").update(valores).eq("id", id).eq("user_id", userId).select("id, title, date, notes").single()
    : supabase.from("calendar_events").insert(valores).select("id, title, date, notes").single();
  const { data, error } = await q;
  if (error || !data) return { error: `Não deu para salvar: ${error?.message ?? "sem retorno"}` };
  revalidatePath("/ferramentas/calendario");
  return { evento: { id: data.id as string, title: data.title as string, date: data.date as string, notes: (data.notes as string | null) ?? null } };
}

export async function excluirEvento(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Data inválida." };
  const { userId, ok } = await podeEscrever();
  if (!userId) return { error: "Entre na sua conta." };
  if (!ok) return { error: MSG_SEM_PLANO };
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: `Não deu para apagar: ${error.message}` };
  revalidatePath("/ferramentas/calendario");
  return {};
}
