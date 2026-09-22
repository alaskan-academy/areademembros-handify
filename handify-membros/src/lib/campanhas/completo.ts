import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";

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

/**
 * Quem já recebeu o convite por qualquer caminho.
 *
 * Esta lista é a trava contra reenvio, e ela tinha duas formas de vir curta.
 * A consulta era um select único: o Supabase corta em 1.000 linhas sem avisar,
 * e a tabela já está em 832 — quem estivesse além do corte voltava a parecer
 * não-convidada e receberia o convite de novo. E o `error` era descartado:
 * qualquer falha passageira devolvia um Set VAZIO, ou seja, a base inteira
 * virava "ninguém foi convidado ainda". Agora pagina até o fim e, se a leitura
 * falhar, joga — melhor o cron ficar vermelho do que mandar tudo outra vez.
 *
 * O `.order()` duplo é a PK (campaign, user_id): `.range()` sem ORDER BY deixa
 * a fronteira de página indefinida no Postgres, e a própria paginação começa a
 * pular linha.
 */
export async function jaConvidadas(service: Service): Promise<Set<string>> {
  const linhas = await fetchAll<{ user_id: string }>((de, ate) =>
    service
      .from("email_campaign_sends")
      .select("user_id")
      .like("campaign", `${PREFIXO}%`)
      .order("campaign")
      .order("user_id")
      .range(de, ate)
  );
  return new Set(linhas.map((r) => r.user_id));
}

/**
 * Quem tem o Completo ativo agora.
 *
 * Mesmo corte de 1.000 do `jaConvidadas`: hoje são 76 assinantes, longe do
 * teto, mas quem passar dele deixaria de ser reconhecida como assinante e
 * receberia convite para um plano que já tem. Ordena por `id` (a PK) para a
 * paginação não pular linha.
 */
export async function comPlanoAtivo(service: Service): Promise<Set<string>> {
  const linhas = await fetchAll<{ user_id: string; expires_at: string | null }>((de, ate) =>
    service
      .from("memberships")
      .select("user_id, expires_at")
      .eq("plan", "completo")
      .is("revoked_at", null)
      .order("id")
      .range(de, ate)
  );
  const agora = Date.now();
  return new Set(
    linhas.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > agora).map((m) => m.user_id)
  );
}

/**
 * Matrículas válidas por aluna.
 *
 * Já paginava na mão, mas sem ORDER BY: em 12 mil linhas e 13 páginas, a
 * fronteira indefinida faz o Postgres repetir e pular matrícula, e aluna que
 * perde uma linha cai abaixo do mínimo de cursos e some do disparo da base.
 * (user_id, course_id) é UNIQUE em enrollments, então a ordem é determinística.
 */
export async function matriculasPorAluna(service: Service): Promise<Map<string, Set<string>>> {
  const agora = new Date().toISOString();
  const linhas = await fetchAll<{ user_id: string; course_id: string }>((de, ate) =>
    service
      .from("enrollments")
      .select("user_id, course_id")
      .or(`expires_at.is.null,expires_at.gt.${agora}`)
      .order("user_id")
      .order("course_id")
      .range(de, ate)
  );
  const porAluna = new Map<string, Set<string>>();
  for (const m of linhas) {
    if (!porAluna.has(m.user_id)) porAluna.set(m.user_id, new Set());
    porAluna.get(m.user_id)!.add(m.course_id);
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

/**
 * Reserva o envio ANTES de mandar o e-mail e devolve só quem foi reservado
 * AGORA — quem já tinha linha não volta no select.
 *
 * Antes era o contrário: mandava o e-mail e só depois gravava, e um erro na
 * gravação virava `console.error`. A aluna recebia o e-mail sem ficar
 * registrada, então uma hora depois ela entrava na fila de novo — até 13
 * e-mails por dia, por 7 dias, na etapa 1; e nas etapas 2 e 3 a condição de
 * "faz mais de 30 dias" nunca mais deixava de ser verdadeira, ou seja, de hora
 * em hora para sempre. Com a reserva antes, a trava contra o repetido passa a
 * ser a PK (campaign, user_id), que ou grava ou joga.
 *
 * Erro aqui é erro de verdade: joga. Os dois crons têm try/catch e devolvem
 * 500 — cron vermelho na Vercel é o que faz alguém olhar.
 */
export async function reservarEnvios(
  service: Service,
  campanha: string,
  linhas: { user_id: string; email: string }[]
): Promise<Set<string>> {
  if (!linhas.length) return new Set();
  // `ignoreDuplicates` + `.select()` vira ON CONFLICT DO NOTHING ... RETURNING:
  // o retorno traz só as linhas realmente inseridas nesta rodada.
  const { data, error } = await service
    .from("email_campaign_sends")
    .upsert(
      linhas.map((l) => ({ campaign: campanha, user_id: l.user_id, email: l.email })),
      { onConflict: "campaign,user_id", ignoreDuplicates: true }
    )
    .select("user_id");
  if (error) throw new Error(`reserva da campanha ${campanha}: ${error.message}`);
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
}

/**
 * Devolve a vez de quem o lote NÃO chegou a enviar. Só aceita user_id que ESTA
 * rodada reservou — apagar linha antiga tiraria a trava de quem já recebeu, e
 * ela receberia tudo de novo.
 */
export async function desfazerReservas(
  service: Service,
  campanha: string,
  userIds: string[]
): Promise<void> {
  if (!userIds.length) return;
  // Em blocos de 300, como no resto do projeto: o `.in()` do PostgREST viaja na
  // URL, e o disparo da base tem centenas de alunas — a lista inteira de uma vez
  // estoura o tamanho da URL e a devolução da vez falharia justo na hora em que
  // é mais necessária.
  for (let i = 0; i < userIds.length; i += 300) {
    const { error } = await service
      .from("email_campaign_sends")
      .delete()
      .eq("campaign", campanha)
      .in("user_id", userIds.slice(i, i + 300));
    if (error) console.error(`[campanha] não consegui desfazer a reserva de ${campanha}:`, error.message);
  }
}
