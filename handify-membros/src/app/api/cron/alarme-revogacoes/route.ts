import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendRevocationAlarmEmail, type RevogacaoSuspeita } from "@/lib/email";

/**
 * Alarme de revogação de acesso em massa.
 *
 * Existe por causa de 09/09/2026: uma regra minha fazia um PIX abandonado
 * revogar o acesso que a aluna tinha pago. Rodou cinco dias, tirou 47 matrículas
 * de 24 alunas, e só foi descoberto porque elas reclamaram. Nada no sistema
 * avisou.
 *
 * Dois gatilhos, e o segundo é o que importa:
 *
 * 1. VOLUME — mais de LIMITE_VOLUME revogações na janela. Pega qualquer regra
 *    nova que comece a revogar demais, seja qual for o motivo.
 *
 * 2. SEM PAGAMENTO — qualquer revogação cuja transação nunca teve um evento de
 *    pagamento aprovado. É a assinatura exata do bug de 09/09, e depois da
 *    correção não deveria acontecer nem uma vez. Alarme dispara a partir de 1.
 *
 * Não repete alarme: só conta o que aconteceu depois do último alarme enviado
 * (registrado no próprio audit_log), então bleeding contínuo alarma de novo a
 * cada leva nova, mas a mesma leva não vira dez e-mails.
 *
 * vercel.json: { "path": "/api/cron/alarme-revogacoes", "schedule": "35 * * * *" }
 */

const LIMITE_VOLUME = 8;
const JANELA_MAX_HORAS = 24;
const EVENTOS_PAGOS = [
  "paid",
  "approved",
  "completed",
  "confirmed",
  "order_approved",
  "subscription_renewed",
];

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

  const destino = process.env.ADMIN_ALERT_EMAIL;
  if (!destino && !simular) {
    console.error("[alarme-revogacoes] ADMIN_ALERT_EMAIL não configurado");
    return NextResponse.json({ error: "ADMIN_ALERT_EMAIL ausente" }, { status: 500 });
  }

  // Janela: desde o último alarme, no máximo 24h atrás. Sem alarme anterior,
  // olha as 24h cheias.
  const tetoJanela = new Date(Date.now() - JANELA_MAX_HORAS * 60 * 60 * 1000);
  const { data: ultimoAlarme } = await service
    .from("audit_log")
    .select("created_at")
    .eq("action", "alarm.revocations")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const desdeData = ultimoAlarme?.created_at
    ? new Date(
        Math.max(new Date(ultimoAlarme.created_at as string).getTime(), tetoJanela.getTime())
      )
    : tetoJanela;
  const desde = desdeData.toISOString();
  const janelaHoras = Math.max(1, Math.round((Date.now() - desdeData.getTime()) / 3_600_000));

  const { data: revogacoes, error: erroRev } = await service
    .from("audit_log")
    .select("created_at, meta")
    .eq("action", "enrollment.revoked")
    .gt("created_at", desde)
    .order("created_at", { ascending: false });

  if (erroRev) {
    console.error("[alarme-revogacoes] erro ao ler audit_log:", erroRev.message);
    return NextResponse.json({ error: erroRev.message }, { status: 500 });
  }

  // Revogação retroativa é correção feita à mão, não evento de plataforma.
  const eventos = (revogacoes ?? []).filter(
    (r) => !(r.meta as Record<string, unknown> | null)?.retroativo
  );

  if (eventos.length === 0) {
    return NextResponse.json({ janelaHoras, total: 0, suspeitas: 0, alarme: false });
  }

  // Quais transações destas revogações chegaram a ser pagas? Uma consulta só.
  const transacoes = [
    ...new Set(
      eventos
        .map((r) => (r.meta as Record<string, unknown> | null)?.transaction_id as string | undefined)
        .filter((t): t is string => !!t)
    ),
  ];

  const pagas = new Set<string>();
  if (transacoes.length) {
    const { data: pagamentos } = await service
      .from("payment_events")
      .select("payload")
      .in("event_type", EVENTOS_PAGOS)
      .filter("payload->>transaction_id", "in", `(${transacoes.join(",")})`);
    for (const p of pagamentos ?? []) {
      const id = (p.payload as Record<string, unknown> | null)?.transaction_id;
      if (typeof id === "string") pagas.add(id);
    }
  }

  // Nomes para o e-mail ser legível sem abrir o painel.
  const userIds = [
    ...new Set(
      eventos
        .map((r) => (r.meta as Record<string, unknown> | null)?.user_id as string | undefined)
        .filter((u): u is string => !!u)
    ),
  ];
  const courseIds = [
    ...new Set(
      eventos
        .map((r) => (r.meta as Record<string, unknown> | null)?.course_id as string | undefined)
        .filter((c): c is string => !!c)
    ),
  ];

  const [{ data: perfis }, { data: cursos }] = await Promise.all([
    userIds.length
      ? service.from("profiles").select("id, email, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null }[] }),
    courseIds.length
      ? service.from("courses").select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const perfilPor = new Map((perfis ?? []).map((p) => [p.id, p]));
  const cursoPor = new Map((cursos ?? []).map((c) => [c.id, c.title]));

  const linhas: RevogacaoSuspeita[] = eventos.map((r) => {
    const meta = (r.meta ?? {}) as Record<string, string | undefined>;
    const perfil = meta.user_id ? perfilPor.get(meta.user_id) : undefined;
    const transacao = meta.transaction_id ?? null;
    return {
      alunaEmail: perfil?.email ?? meta.user_id ?? "—",
      alunaNome: perfil?.full_name ?? null,
      curso: (meta.course_id ? cursoPor.get(meta.course_id) : undefined) ?? "—",
      transacao,
      quando: r.created_at as string,
      // Sem transação registrada não dá para afirmar que não foi paga — não
      // conta como suspeita, para o alarme não gritar por falta de dado.
      transacaoFoiPaga: transacao ? pagas.has(transacao) : true,
    };
  });

  const suspeitas = linhas.filter((l) => !l.transacaoFoiPaga).length;
  const total = linhas.length;
  const alarme = suspeitas > 0 || total > LIMITE_VOLUME;

  if (!alarme) {
    return NextResponse.json({ janelaHoras, total, suspeitas, alarme: false });
  }

  if (simular) {
    return NextResponse.json({
      simulacao: true,
      janelaHoras,
      total,
      suspeitas,
      alarme: true,
      motivo: suspeitas > 0 ? "revogação sem pagamento" : "volume",
      linhas: linhas.slice(0, 10),
    });
  }

  await sendRevocationAlarmEmail({
    to: destino!,
    janelaHoras,
    total,
    suspeitas,
    linhas,
  });

  await service.from("audit_log").insert({
    admin_id: null,
    action: "alarm.revocations",
    target_type: "system",
    target_id: null,
    meta: {
      janela_horas: janelaHoras,
      total,
      suspeitas,
      motivo: suspeitas > 0 ? "revogacao_sem_pagamento" : "volume",
      destino,
    },
  });

  console.warn(
    `[alarme-revogacoes] ALARME: ${total} revogações (${suspeitas} sem pagamento) em ${janelaHoras}h`
  );

  return NextResponse.json({ janelaHoras, total, suspeitas, alarme: true, enviado: true });
}
