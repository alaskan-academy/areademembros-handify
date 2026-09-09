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

  // count: "exact" traz o total de verdade mesmo quando o Supabase corta as
  // linhas em 1.000 — foi assim que quatro telas de métrica mentiram em 02/09.
  // As linhas detalhadas são só para o corpo do e-mail; o número vem do count.
  const { data: revogacoes, error: erroRev, count: totalReal } = await service
    .from("audit_log")
    .select("created_at, meta, action", { count: "exact" })
    .in("action", ["enrollment.revoked", "membership.revoked"])
    .is("admin_id", null)
    .gt("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(500);

  if (erroRev) {
    console.error("[alarme-revogacoes] erro ao ler audit_log:", erroRev.message);
    return NextResponse.json({ error: erroRev.message }, { status: 500 });
  }

  // Revogação retroativa NÃO é filtrada: um backfill que revoga em massa é
  // exatamente o que precisa ser visto. Foi um backfill meu, em 03/09, que
  // deixou duas alunas pagantes sem 22 cursos cada por seis dias — e a primeira
  // versão deste alarme descartava justamente essas linhas.
  // admin_id null no filtro acima já separa o automático do que a admin fez à mão.
  const eventos = revogacoes ?? [];

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
  // O filtro "in" do PostgREST é montado como texto, então vírgula, parêntese ou
  // aspas num id quebrariam a consulta. Id de transação é alfanumérico nas duas
  // plataformas; o que não for, fica de fora e a revogação conta como suspeita —
  // que é o lado seguro de errar.
  const transacoesSeguras = transacoes.filter((t) => /^[A-Za-z0-9_-]{1,64}$/.test(t));
  if (transacoesSeguras.length !== transacoes.length) {
    console.warn(
      `[alarme-revogacoes] ${transacoes.length - transacoesSeguras.length} id(s) de transação fora do formato esperado`
    );
  }
  if (transacoesSeguras.length) {
    const { data: pagamentos } = await service
      .from("payment_events")
      .select("payload")
      .in("event_type", EVENTOS_PAGOS)
      .filter("payload->>transaction_id", "in", `(${transacoesSeguras.join(",")})`);
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
      // Sem transação registrada, NÃO dá para provar que houve estorno — e é
      // justamente essa a forma do backfill que causou o incidente. Conta como
      // suspeita. Revogação feita à mão pela admin usa outra ação (revoke_access)
      // e já ficou de fora pelo filtro de admin_id, então isto não vira ruído.
      transacaoFoiPaga: transacao ? pagas.has(transacao) : false,
    };
  });

  const suspeitas = linhas.filter((l) => !l.transacaoFoiPaga).length;
  const total = totalReal ?? linhas.length;
  if (total > linhas.length) {
    console.warn(`[alarme-revogacoes] ${total} revogações na janela, e-mail lista ${linhas.length}`);
  }
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

  const saiu = await sendRevocationAlarmEmail({
    to: destino!,
    janelaHoras,
    total,
    suspeitas,
    linhas,
  });

  // O marcador avança a janela: gravá-lo sem o e-mail ter saído esconderia
  // estas revogações de toda execução futura. Falhou o envio, não marca — a
  // próxima rodada tenta de novo com a mesma janela.
  if (!saiu) {
    console.error("[alarme-revogacoes] e-mail NÃO saiu — janela mantida para a próxima rodada");
    return NextResponse.json(
      { janelaHoras, total, suspeitas, alarme: true, enviado: false },
      { status: 500 }
    );
  }

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
