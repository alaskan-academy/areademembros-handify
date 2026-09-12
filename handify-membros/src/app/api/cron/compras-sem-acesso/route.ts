import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendComprasSemAcessoEmail, type CompraSemAcesso } from "@/lib/email";
import { mesmoPrimeiroNome } from "@/lib/auth/vincular-compra";

/**
 * Alarme de compra paga que não virou acesso.
 *
 * Existe por causa de 12/09/2026: uma varredura achou 7 alunas pagantes sem os
 * cursos que compraram — 43 matrículas, a mais antiga parada havia 41 dias.
 * Nenhuma tinha reclamado no suporte, e nada no sistema avisava. A causa é quase
 * sempre a aluna digitar o próprio e-mail errado (um "n" a mais, "hormail",
 * ".com.com"): a compra fica num endereço e a conta em outro.
 *
 * O cadastro e o webhook agora ligam a compra pelo telefone + primeiro nome.
 * Este cron é a terceira camada — o que escapar da regra vira e-mail para a
 * admin em vez de virar silêncio.
 *
 * vercel.json: { "path": "/api/cron/compras-sem-acesso", "schedule": "40 12 * * *" }
 */

/** Dias de tolerância: a aluna precisa de tempo para receber o e-mail e se cadastrar. */
const DIAS_DE_TOLERANCIA = 1;
/** Sem caso novo, repete o aviso no máximo a cada 7 dias para não virar ruído. */
const DIAS_ENTRE_REPETICOES = 7;

type LinhaRpc = {
  email_da_compra: string;
  email_da_conta: string | null;
  nome_da_compra: string | null;
  nome_da_conta: string | null;
  vinculo: "email" | "telefone";
  user_id: string;
  curso: string;
  comprado_em: string;
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

  const destino = process.env.ADMIN_ALERT_EMAIL;
  if (!destino && !simular) {
    console.error("[compras-sem-acesso] ADMIN_ALERT_EMAIL não configurado");
    return NextResponse.json({ error: "ADMIN_ALERT_EMAIL ausente" }, { status: 500 });
  }

  const { data, error } = await service.rpc("compras_sem_acesso", {
    dias_minimos: DIAS_DE_TOLERANCIA,
  });

  if (error) {
    console.error("[compras-sem-acesso] erro na consulta:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const linhas = (data ?? []) as LinhaRpc[];

  // Agrupa por e-mail da compra: a aluna que comprou 23 itens é UM caso, não 23.
  const porCompra = new Map<string, CompraSemAcesso>();
  for (const l of linhas) {
    // Vínculo por telefone com primeiro nome diferente não afirma que é a mesma
    // pessoa — é o caso real de hzpdp@gmail.com, telefone de família com duas
    // pessoas. Vai para o e-mail assim mesmo, marcado para conferência, porque a
    // compra existe e alguém precisa resolver.
    const mesmaPessoa =
      l.vinculo === "email" || mesmoPrimeiroNome(l.nome_da_compra, l.nome_da_conta);

    const chave = l.email_da_compra.toLowerCase();
    const existente = porCompra.get(chave);
    if (existente) {
      existente.cursos.push(l.curso);
      continue;
    }

    const comprado = new Date(l.comprado_em);
    porCompra.set(chave, {
      emailDaCompra: chave,
      emailDaConta: mesmaPessoa ? l.email_da_conta : null,
      nome: l.nome_da_compra,
      vinculo: mesmaPessoa ? l.vinculo : "sem conta",
      cursos: [l.curso],
      compradoEm: l.comprado_em,
      diasParado: Math.max(0, Math.floor((Date.now() - comprado.getTime()) / 86_400_000)),
    });
  }

  const casos = [...porCompra.values()].sort((a, b) => b.diasParado - a.diasParado);

  if (casos.length === 0) {
    return NextResponse.json({ casos: 0, enviado: false });
  }

  // Já avisamos sobre exatamente estas compras? Só repete se apareceu caso novo
  // ou se o último aviso já tem uma semana.
  const { data: ultimo } = await service
    .from("audit_log")
    .select("created_at, meta")
    .eq("action", "alarm.purchases_without_access")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const jaAvisados = new Set<string>(
    ((ultimo?.meta as Record<string, unknown> | null)?.emails as string[] | undefined) ?? []
  );
  const novos = casos.filter((c) => !jaAvisados.has(c.emailDaCompra));
  const diasDesdeUltimo = ultimo?.created_at
    ? (Date.now() - new Date(ultimo.created_at as string).getTime()) / 86_400_000
    : Infinity;

  const deveAvisar = novos.length > 0 || diasDesdeUltimo >= DIAS_ENTRE_REPETICOES;

  if (simular) {
    return NextResponse.json({
      simulacao: true,
      casos: casos.length,
      cursos: casos.reduce((s, c) => s + c.cursos.length, 0),
      novos: novos.length,
      deveAvisar,
      lista: casos,
    });
  }

  if (!deveAvisar) {
    return NextResponse.json({ casos: casos.length, novos: 0, enviado: false });
  }

  const saiu = await sendComprasSemAcessoEmail({ to: destino!, casos });

  // O marcador guarda a lista avisada. Gravá-lo sem o e-mail ter saído faria a
  // próxima rodada achar que já avisou — e essas alunas sumiriam do radar. Mesmo
  // erro que o alarme de revogação já cometeu uma vez.
  if (!saiu) {
    console.error("[compras-sem-acesso] e-mail NÃO saiu — nada marcado, tenta de novo amanhã");
    return NextResponse.json({ casos: casos.length, enviado: false }, { status: 500 });
  }

  await service.from("audit_log").insert({
    admin_id: null,
    action: "alarm.purchases_without_access",
    target_type: "system",
    target_id: null,
    meta: {
      casos: casos.length,
      cursos: casos.reduce((s, c) => s + c.cursos.length, 0),
      emails: casos.map((c) => c.emailDaCompra),
      destino,
    },
  });

  console.warn(
    `[compras-sem-acesso] ALARME: ${casos.length} compra(s) sem acesso, ${novos.length} nova(s)`
  );

  return NextResponse.json({ casos: casos.length, novos: novos.length, enviado: true });
}
