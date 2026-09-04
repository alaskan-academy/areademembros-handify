import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Convite ao Handify Completo — a parte que os dois caminhos compartilham:
 * o disparo único para a base (segunda de manhã) e o gatilho automático de
 * quem conclui o primeiro curso.
 *
 * Regra que vale para os dois: **cada aluna entra por um caminho só**. Quem
 * recebeu o disparo da base não entra na sequência de conclusão, e quem está
 * na sequência não recebe o disparo da base — é o que a tabela
 * `email_campaign_sends` garante, com o prefixo `plano-completo`.
 */

export const CAMPANHA_BASE = "plano-completo-base";
export const CAMPANHA_CONCLUSAO = "plano-completo-conclusao";
const PREFIXO = "plano-completo";

/**
 * A sequência de quem conclui o primeiro curso: 3 e-mails, um por mês —
 * contados a partir da conclusão dela, não de uma data fixa. Depois do
 * terceiro, para. Também para na hora em que ela assina o Completo.
 */
export const ETAPAS_CONCLUSAO = 3;
export const DIAS_ENTRE_ETAPAS = 30;

/** Mínimo de cursos para entrar no disparo da base. */
export const MIN_CURSOS_BASE = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = SupabaseClient<any, "public", any>;

export type Convidada = { id: string; nome: string; email: string; cursos: string[] };

/** Link do checkout com UTM próprio, para separar no relatório de onde veio. */
export function linkComUtm(linkBase: string, campanha: string): string {
  try {
    const u = new URL(linkBase);
    u.searchParams.set("utm_source", "email");
    u.searchParams.set("utm_medium", "email");
    u.searchParams.set("utm_campaign", "handifycompleto");
    u.searchParams.set("utm_content", campanha);
    return u.toString();
  } catch {
    return linkBase;
  }
}

export async function linkDoPlano(service: Service): Promise<string | null> {
  const { data } = await service.from("annual_promo").select("link_url").eq("active", true).maybeSingle();
  return (data?.link_url as string | undefined) ?? null;
}

/** O que o plano abre (10 cursos + 13 materiais) — o "de 23" do e-mail. */
export async function cursosDoPlano(service: Service): Promise<Map<string, string>> {
  const { data } = await service.from("courses").select("id, title").eq("in_plan", true);
  return new Map((data ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
}

/** Quem já recebeu o convite por qualquer caminho. */
export async function jaConvidadas(service: Service): Promise<Set<string>> {
  const { data } = await service.from("email_campaign_sends").select("user_id").like("campaign", `${PREFIXO}%`);
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
}

/** Quem tem o Completo ativo agora. */
export async function comPlanoAtivo(service: Service): Promise<Set<string>> {
  const { data, error } = await service.from("memberships").select("user_id, expires_at").eq("plan", "completo").is("revoked_at", null);
  if (error) throw new Error(`memberships: ${error.message}`);
  const agora = Date.now();
  return new Set(
    (data ?? [])
      .filter((m: { expires_at: string | null }) => !m.expires_at || new Date(m.expires_at).getTime() > agora)
      .map((m: { user_id: string }) => m.user_id)
  );
}

/** Matrículas válidas por aluna (paginado: são milhares de linhas). */
export async function matriculasPorAluna(service: Service): Promise<Map<string, Set<string>>> {
  const agora = new Date().toISOString();
  const porAluna = new Map<string, Set<string>>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await service
      .from("enrollments")
      .select("user_id, course_id")
      .or(`expires_at.is.null,expires_at.gt.${agora}`)
      .range(de, de + 999);
    if (error) throw new Error(`enrollments: ${error.message}`);
    for (const m of (data ?? []) as { user_id: string; course_id: string }[]) {
      if (!porAluna.has(m.user_id)) porAluna.set(m.user_id, new Set());
      porAluna.get(m.user_id)!.add(m.course_id);
    }
    if ((data ?? []).length < 1000) break;
  }
  return porAluna;
}

/**
 * Pode receber? Sem e-mail, banida, opt-out, já convidada ou já assinante: não.
 * O opt-out usado é `news_post` — o mesmo que ela desmarca no perfil.
 */
export function podeReceber(
  p: { id: string; email: string | null; banned: boolean | null; email_prefs: Record<string, boolean> | null },
  jaConvidada: Set<string>,
  comPlano: Set<string>
): { ok: boolean; motivo?: "semEmail" | "banida" | "optOut" | "jaRecebeu" | "comPlano" } {
  if (!p.email) return { ok: false, motivo: "semEmail" };
  if (p.banned) return { ok: false, motivo: "banida" };
  if (p.email_prefs?.news_post === false) return { ok: false, motivo: "optOut" };
  if (jaConvidada.has(p.id)) return { ok: false, motivo: "jaRecebeu" };
  if (comPlano.has(p.id)) return { ok: false, motivo: "comPlano" };
  return { ok: true };
}

export async function registrarEnvios(service: Service, campanha: string, linhas: { user_id: string; email: string }[]): Promise<void> {
  if (!linhas.length) return;
  const { error } = await service.from("email_campaign_sends").upsert(
    linhas.map((l) => ({ campaign: campanha, user_id: l.user_id, email: l.email })),
    { onConflict: "campaign,user_id" }
  );
  if (error) console.error("[campanha] registro:", error.message);
}
