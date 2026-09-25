import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPlanUpgradeEmailBatch } from "@/lib/email";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  CAMPANHA_CONCLUSAO,
  ETAPAS_CONCLUSAO,
  DIAS_ENTRE_ETAPAS,
  comPlanoAtivo,
  cursosDoPlano,
  jaConvidadas,
  linkComUtm,
  linkDoPlano,
  reservarEnvios,
  desfazerReservas,
} from "@/lib/campanhas/completo";

/**
 * Convite ao Completo para quem comprou e concluiu — uma sequência de 3
 * e-mails, um por mês:
 *
 *   1º  2 h depois de ela concluir o PRIMEIRO curso (abre parabenizando)
 *   2º  30 dias depois do 1º
 *   3º  30 dias depois do 2º — e acaba aqui
 *
 * Para na hora em que ela assina o Handify Completo, e nunca chega a quem já
 * recebeu o convite pela campanha da base. Quem pediu para não receber
 * (`email_prefs.news_post`) fica de fora.
 *
 * Roda de hora em hora e só envia entre 8 h e 21 h de Brasília — quem concluir
 * de madrugada recebe de manhã, não às 3 h.
 *
 * vercel.json: { "path": "/api/cron/convite-completo", "schedule": "20 * * * *" }
 */

export const maxDuration = 60;

const HORA_INICIO = 8;
const HORA_FIM = 21;

function horaBRT(): number {
  return Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `?simular=1` monta a fila e devolve os números sem enviar nada. Não existe
  // atalho para enviar fora de hora: quem dispara é o cron, no horário.
  const simular = new URL(req.url).searchParams.get("simular") === "1";
  const hora = horaBRT();
  if (hora < HORA_INICIO || hora >= HORA_FIM) {
    if (!simular) return NextResponse.json({ enviados: 0, motivo: `fora do horário de envio (${HORA_INICIO}h–${HORA_FIM}h), agora são ${hora}h` });
  }

  try {
    const service = createServiceClient();
    const agora = Date.now();
    const duasHoras = new Date(agora - 2 * 60 * 60 * 1000).toISOString();
    const seteDias = new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString();
    const umMes = new Date(agora - DIAS_ENTRE_ETAPAS * 24 * 60 * 60 * 1000).toISOString();

    // Esta leitura é quem sabe em que etapa cada aluna está. Era um select
    // único, cortado em 1.000 linhas pelo Supabase e com o erro descartado:
    // aluna que ficasse de fora do recorte aparecia como nova e voltava a
    // receber a etapa 1, um e-mail que ela já tinha recebido. Pagina até o fim
    // e, na falha, joga — o catch lá embaixo devolve 500 e nada sai.
    const [linkBase, titulos, comPlano, enviosSeq] = await Promise.all([
      linkDoPlano(service),
      cursosDoPlano(service),
      comPlanoAtivo(service),
      fetchAll<{ campaign: string; user_id: string; sent_at: string }>((de, ate) =>
        service
          .from("email_campaign_sends")
          .select("campaign, user_id, sent_at")
          .like("campaign", `${CAMPANHA_CONCLUSAO}%`)
          .order("campaign")
          .order("user_id")
          .range(de, ate)
      ),
    ]);
    if (!linkBase) return NextResponse.json({ error: "Sem link do plano ativo em annual_promo" }, { status: 500 });
    const totalDoPlano = titulos.size;

    // Em que etapa cada aluna está, e quando recebeu a última.
    const etapaDe = new Map<string, { etapa: number; em: string }>();
    for (const e of enviosSeq) {
      const etapa = Number(e.campaign.split("-").pop());
      const atual = etapaDe.get(e.user_id);
      if (!atual || etapa > atual.etapa) etapaDe.set(e.user_id, { etapa, em: e.sent_at });
    }

    // ── Quem entra agora (etapa 1): concluiu o primeiro curso há mais de 2 h.
    // Olha 7 dias para trás em vez de uma janela de 1 h: quem termina de
    // madrugada, ou num dia em que o cron falhou, não fica sem receber.
    const { data: recentes, error } = await service.from("certificates").select("user_id, course_id, issued_at").gte("issued_at", seteDias).lte("issued_at", duasHoras);
    if (error) throw new Error(`certificates: ${error.message}`);

    const novas = [...new Set((recentes ?? []).map((c) => c.user_id as string))].filter((id) => !etapaDe.has(id));
    let primeiros: string[] = [];
    if (novas.length) {
      // Primeiro curso: ela só pode ter este certificado.
      const { data: todos } = await service.from("certificates").select("user_id").in("user_id", novas);
      const quantos = new Map<string, number>();
      for (const c of todos ?? []) quantos.set(c.user_id as string, (quantos.get(c.user_id as string) ?? 0) + 1);
      const jaConvidada = await jaConvidadas(service);
      primeiros = novas.filter((id) => (quantos.get(id) ?? 0) === 1 && !jaConvidada.has(id) && !comPlano.has(id));
    }

    // ── Quem continua (etapas 2 e 3): recebeu a anterior há 30 dias ou mais.
    const seguindo = [...etapaDe.entries()]
      .filter(([id, { etapa, em }]) => etapa < ETAPAS_CONCLUSAO && em <= umMes && !comPlano.has(id))
      .map(([id, { etapa }]) => ({ id, proxima: etapa + 1 }));

    const alvos = [...primeiros.map((id) => ({ id, proxima: 1 })), ...seguindo];
    if (!alvos.length) return NextResponse.json({ enviados: 0, motivo: "ninguém na fila agora" });

    const ids = alvos.map((a) => a.id);
    const agoraIso = new Date(agora).toISOString();
    const [{ data: perfis }, { data: minhas }, { data: cursos }] = await Promise.all([
      service.from("profiles").select("id, full_name, email, banned, email_prefs").in("id", ids),
      // `expires_at` ESTAVA FALTANDO AQUI. Sem ele, o e-mail listava como
      // "cursos que você já tem" os cursos que a aluna tinha perdido no
      // reembolso: uma estornada em 18/09/2026 recebeu o convite em 22/09 com
      // os 23 cursos do plano listados, 22 deles revogados.
      service
        .from("enrollments")
        .select("user_id, course_id")
        .in("user_id", ids)
        .or(`expires_at.is.null,expires_at.gt.${agoraIso}`),
      service.from("courses").select("id, title"),
    ]);

    // Quem ainda tem ALGUM acesso vivo — em qualquer curso, do plano ou não.
    // É a guarda que faltava: a sequência é disparada por `certificates` e
    // continuada por `email_campaign_sends`, e nenhuma das três etapas
    // perguntava se a aluna ainda era aluna. Quem pediu reembolso depois de
    // concluir o curso seguia recebendo "parabéns, assine o Completo".
    const temAcesso = new Set((minhas ?? []).map((m) => (m as { user_id: string }).user_id));
    const nomeCurso = new Map((cursos ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
    const porAluna = new Map<string, string[]>();
    for (const m of (minhas ?? []) as { user_id: string; course_id: string }[]) {
      const titulo = titulos.get(m.course_id);
      if (titulo) porAluna.set(m.user_id, [...(porAluna.get(m.user_id) ?? []), titulo]);
    }

    // Uma chamada de envio por etapa (o registro precisa saber qual foi).
    const porEtapa = new Map<number, { to: string; user_id: string; studentName: string; cursosQueTem: string[]; totalDoPlano: number; linkUrl: string; momento?: "conclusao"; cursoConcluido?: string | null }[]>();
    for (const a of alvos) {
      const p = (perfis ?? []).find((x) => x.id === a.id) as { id: string; full_name: string | null; email: string | null; banned: boolean | null; email_prefs: Record<string, boolean> | null } | undefined;
      if (!p?.email || p.banned || p.email_prefs?.news_post === false) continue;
      // Perdeu o acesso (reembolso, chargeback, matrícula vencida): sai da fila
      // e não recebe a próxima etapa. Vale para entrar e para continuar.
      if (!temAcesso.has(p.id)) continue;
      const concluido = a.proxima === 1 ? ((recentes ?? []).find((c) => c.user_id === p.id)?.course_id as string | undefined) : undefined;
      const item = {
        to: p.email,
        user_id: p.id,
        studentName: p.full_name || "aluna",
        cursosQueTem: porAluna.get(p.id) ?? ["cursos da Handify"],
        totalDoPlano,
        linkUrl: linkComUtm(linkBase, `${CAMPANHA_CONCLUSAO}-${a.proxima}`),
        // Só o primeiro abre parabenizando; os outros dois seguem no tom da campanha.
        ...(a.proxima === 1 ? { momento: "conclusao" as const, cursoConcluido: concluido ? nomeCurso.get(concluido) ?? null : null } : {}),
      };
      porEtapa.set(a.proxima, [...(porEtapa.get(a.proxima) ?? []), item]);
    }

    if (simular) {
      return NextResponse.json({
        simulacao: true,
        enviados: 0,
        naFila: [...porEtapa.entries()].map(([etapa, f]) => ({ etapa, quantas: f.length, exemplo: f[0]?.to })),
      });
    }

    let total = 0;
    const detalhe: Record<string, number> = {};
    const falhas: string[] = [];
    for (const [etapa, fila] of porEtapa) {
      const campanha = `${CAMPANHA_CONCLUSAO}-${etapa}`;

      // Reserva primeiro: se o banco falhar aqui, nada saiu e nada se repete.
      const reservados = await reservarEnvios(
        service,
        campanha,
        fila.map((f) => ({ user_id: f.user_id, email: f.to }))
      );
      const paraEnviar = fila.filter((f) => reservados.has(f.user_id));
      if (!paraEnviar.length) continue;

      const { enviados, erro } = await sendPlanUpgradeEmailBatch(paraEnviar);
      const ok = new Set(enviados.map((e) => e.toLowerCase()));

      if (erro) {
        // O lote parou no meio. Devolve a vez SÓ de quem não chegou a receber.
        // Sem erro, quem ficou de fora foi a lista de supressão — essa fica
        // reservada de propósito, senão volta à fila de hora em hora para
        // sempre, e a Resend nunca entregou nada nesse endereço mesmo.
        await desfazerReservas(
          service,
          campanha,
          paraEnviar.filter((f) => !ok.has(f.to.toLowerCase())).map((f) => f.user_id)
        );
        console.error(`[convite-completo] etapa ${etapa}: ${erro}`);
        falhas.push(`etapa ${etapa}: ${erro}`);
      }

      total += enviados.length;
      detalhe[`etapa${etapa}`] = enviados.length;
    }

    console.log(`[convite-completo] enviados ${total}`, detalhe);
    // 500 de propósito: antes a rota devolvia 200 mesmo com o lote quebrado, e
    // o cron ficava verde com aluna sem receber. Mesma escolha do
    // alarme-revogacoes.
    if (falhas.length) {
      return NextResponse.json({ enviados: total, ...detalhe, erro: falhas.join("; ") }, { status: 500 });
    }
    return NextResponse.json({ enviados: total, ...detalhe });
  } catch (e) {
    console.error("[convite-completo]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
