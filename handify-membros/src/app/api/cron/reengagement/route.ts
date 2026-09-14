import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendReengagementEmailBatch, type ReengagementCourse } from "@/lib/email";

/**
 * Reengajamento — "você parou no meio, volta lá".
 *
 * Semanal, no máximo 4 vezes por aluna, e sempre atrás das campanhas do
 * Handify Completo. A ordem de prioridade é:
 *
 *   Convite Completo (conclusão)  >  Campanha Completo (base)  >  Reengajamento
 *
 * Os dois primeiros mandam sempre; este é o único que se abstém.
 *
 * ── Por que roda às 21h30 de quinta ─────────────────────────────────────────
 *
 * A janela do convite-completo é 8h–21h BRT, TODO dia. Qualquer horário
 * comercial pode colidir: o reengajamento sairia de manhã e o convite para a
 * mesma aluna à tarde, no mesmo dia. Rodando às 21h30, a janela do dia já
 * fechou e a do dia seguinte ainda não abriu — a colisão deixa de ser
 * improvável e passa a ser impossível, sem precisar duplicar a regra da
 * sequência de conclusão aqui dentro.
 *
 * Quinta também evita a terça, dia do disparo da base.
 *
 * ── O que estava errado antes ───────────────────────────────────────────────
 *
 * 1. Nenhuma trava de repetição: nada era registrado, então quem ficasse 30
 *    dias sem entrar receberia o mesmo e-mail 30 vezes.
 * 2. A busca de matrículas não tinha limite e o PostgREST corta em 1.000 —
 *    via 1.000 das 10.005, sempre as mesmas.
 * 3. Quatro consultas por matrícula dentro do laço, sem maxDuration: 4.000
 *    consultas em sequência, que estouravam o tempo antes de mandar nada.
 *
 * O item 3 escondia o item 1. Consertar só o desempenho teria virado spam
 * diário para ~2.500 alunas.
 *
 * vercel.json: { "path": "/api/cron/reengagement", "schedule": "30 0 * * 5" }
 */

export const maxDuration = 60;

/** Dias sem abrir o curso para a aluna entrar na fila. */
const DIAS_DE_INATIVIDADE = 7;
/** Teto de e-mails por aluna, para sempre. Depois do 4º, nunca mais. */
const MAX_CICLOS = 4;
/** Intervalo mínimo entre dois e-mails para a mesma aluna. */
const DIAS_ENTRE_CICLOS = 7;
/**
 * Teto por execução, aplicado DENTRO do banco.
 *
 * Não é só para caber nos 60s: o PostgREST corta qualquer resposta em 1.000
 * linhas, RPC incluído. Sem ordenar e cortar no SQL, o cron receberia 1.000
 * alunas arbitrárias das ~1.900 — a mesma armadilha que quebrava a versão
 * antiga, só que do outro lado. Com a ordem no banco, as que vêm são as que
 * esperam há mais tempo, e o resto sai na semana seguinte.
 *
 * 900 deixa folga abaixo do corte: em lotes de 100 são 9 chamadas à Resend.
 */
const MAX_POR_EXECUCAO = 900;

type LinhaElegivel = {
  user_id: string;
  email: string;
  full_name: string | null;
  proximo_ciclo: number;
  cursos: ReengagementCourse[];
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  const autorizado =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || cronSecret === process.env.CRON_SECRET;
  if (!autorizado) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const simular = req.nextUrl.searchParams.get("simular") === "1";
  const service = createServiceClient();

  // Toda a elegibilidade mora no banco: opt-out, teto de ciclos, intervalo e a
  // prioridade das campanhas do Completo. Uma consulta no lugar de 4.000.
  const { data, error } = await service.rpc("alunas_para_reengajar", {
    dias_inatividade: DIAS_DE_INATIVIDADE,
    max_ciclos: MAX_CICLOS,
    dias_entre_ciclos: DIAS_ENTRE_CICLOS,
    limite: MAX_POR_EXECUCAO,
  });

  if (error) {
    console.error("[cron/reengagement] erro na consulta:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Já vem ordenada e cortada do banco — quem espera há mais tempo primeiro.
  const fila = (data ?? []) as LinhaElegivel[];

  if (simular) {
    return NextResponse.json({
      simulacao: true,
      nesta_execucao: fila.length,
      atingiu_o_teto: fila.length === MAX_POR_EXECUCAO,
      por_ciclo: [1, 2, 3, 4].map((c) => ({
        ciclo: c,
        alunas: fila.filter((e) => e.proximo_ciclo === c).length,
      })),
      amostra: fila.slice(0, 5).map((f) => ({
        email: f.email,
        ciclo: f.proximo_ciclo,
        cursos: f.cursos.map((c) => `${c.title} (${c.progressPercent}%)`),
      })),
    });
  }

  if (!fila.length) {
    return NextResponse.json({ nesta_execucao: 0, enviados: 0 });
  }

  const { enviados, erro } = await sendReengagementEmailBatch(
    fila.map((f) => ({
      to: f.email,
      studentName: f.full_name ?? "Aluna",
      courses: f.cursos,
    }))
  );

  // Só registra quem a Resend aceitou. Registrar antes do envio gastaria um
  // ciclo da aluna sem ela receber nada — e são só 4 na vida dela.
  const enviadosSet = new Set(enviados.map((e: string) => e.toLowerCase()));
  const registros = fila
    .filter((f) => enviadosSet.has(f.email.toLowerCase()))
    .map((f) => ({
      campaign: `reengajamento-${f.proximo_ciclo}`,
      user_id: f.user_id,
      email: f.email,
    }));

  if (registros.length) {
    const { error: erroRegistro } = await service
      .from("email_campaign_sends")
      .upsert(registros, { onConflict: "campaign,user_id" });
    if (erroRegistro) {
      // Sem o registro a aluna receberia de novo na semana seguinte. É o tipo de
      // falha que precisa aparecer, não ficar num console.
      console.error("[cron/reengagement] FALHA AO REGISTRAR ENVIO:", erroRegistro.message);
      return NextResponse.json(
        { enviados: enviados.length, registrados: 0, erro: erroRegistro.message },
        { status: 500 }
      );
    }
  }

  console.info(
    `[cron/reengagement] ${enviados.length} e-mail(s) enviados, ${registros.length} registrados` +
      (erro ? ` — interrompido: ${erro}` : "")
  );

  return NextResponse.json({
    nesta_execucao: fila.length,
    enviados: enviados.length,
    registrados: registros.length,
    erro,
  });
}
