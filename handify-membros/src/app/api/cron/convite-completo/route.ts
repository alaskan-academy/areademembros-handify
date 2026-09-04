import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPlanUpgradeEmailBatch } from "@/lib/email";
import {
  CAMPANHA_CONCLUSAO,
  ETAPAS_CONCLUSAO,
  DIAS_ENTRE_ETAPAS,
  comPlanoAtivo,
  cursosDoPlano,
  jaConvidadas,
  linkComUtm,
  linkDoPlano,
  registrarEnvios,
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

    const [linkBase, titulos, comPlano, { data: enviosSeq }] = await Promise.all([
      linkDoPlano(service),
      cursosDoPlano(service),
      comPlanoAtivo(service),
      service.from("email_campaign_sends").select("campaign, user_id, sent_at").like("campaign", `${CAMPANHA_CONCLUSAO}%`),
    ]);
    if (!linkBase) return NextResponse.json({ error: "Sem link do plano ativo em annual_promo" }, { status: 500 });
    const totalDoPlano = titulos.size;

    // Em que etapa cada aluna está, e quando recebeu a última.
    const etapaDe = new Map<string, { etapa: number; em: string }>();
    for (const e of (enviosSeq ?? []) as { campaign: string; user_id: string; sent_at: string }[]) {
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
    const [{ data: perfis }, { data: minhas }, { data: cursos }] = await Promise.all([
      service.from("profiles").select("id, full_name, email, banned, email_prefs").in("id", ids),
      service.from("enrollments").select("user_id, course_id").in("user_id", ids),
      service.from("courses").select("id, title"),
    ]);
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
    for (const [etapa, fila] of porEtapa) {
      const { enviados, erro } = await sendPlanUpgradeEmailBatch(fila);
      const ok = new Set(enviados.map((e) => e.toLowerCase()));
      await registrarEnvios(
        service,
        `${CAMPANHA_CONCLUSAO}-${etapa}`,
        fila.filter((f) => ok.has(f.to.toLowerCase())).map((f) => ({ user_id: f.user_id, email: f.to }))
      );
      total += enviados.length;
      detalhe[`etapa${etapa}`] = enviados.length;
      if (erro) console.error(`[convite-completo] etapa ${etapa}: ${erro}`);
    }

    console.log(`[convite-completo] enviados ${total}`, detalhe);
    return NextResponse.json({ enviados: total, ...detalhe });
  } catch (e) {
    console.error("[convite-completo]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
