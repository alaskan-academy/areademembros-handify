import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPlanUpgradeEmailBatch } from "@/lib/email";
import {
  CAMPANHA_BASE,
  MIN_CURSOS_BASE,
  comPlanoAtivo,
  cursosDoPlano,
  jaConvidadas,
  linkComUtm,
  linkDoPlano,
  matriculasPorAluna,
  podeReceber,
  registrarEnvios,
} from "@/lib/campanhas/completo";

/**
 * Disparo ÚNICO do convite ao Handify Completo para a base que já existe:
 * alunas com 4 ou mais cursos e sem o plano. Roda na segunda, 8h de Brasília.
 *
 * É de uma vez só de propósito: quem comprar daqui pra frente recebe pelo
 * gatilho de conclusão (`/api/cron/convite-completo`). Por isso a trava de
 * data: em qualquer outro dia a rota não envia nada. Para adiar, mude
 * `DATA_DO_DISPARO`; para cancelar, tire o cron do vercel.json.
 *
 * vercel.json: { "path": "/api/cron/campanha-completo", "schedule": "0 11 * * 1" }
 */

/** Segunda-feira, 07/09/2026. Fora desta data a rota não envia. */
const DATA_DO_DISPARO = "2026-09-07";

export const maxDuration = 300;

function hojeBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `?simular=1` monta a fila e devolve os números sem enviar nada. Não existe
  // atalho para enviar fora da data: quem dispara é o cron, no dia marcado.
  const simular = new URL(req.url).searchParams.get("simular") === "1";
  const hoje = hojeBRT();
  if (hoje !== DATA_DO_DISPARO && !simular) {
    return NextResponse.json({ enviados: 0, motivo: `fora da data do disparo (${DATA_DO_DISPARO}), hoje é ${hoje}` });
  }

  try {
    const service = createServiceClient();
    const [linkBase, titulos, jaConvidada, comPlano, porAluna] = await Promise.all([
      linkDoPlano(service),
      cursosDoPlano(service),
      jaConvidadas(service),
      comPlanoAtivo(service),
      matriculasPorAluna(service),
    ]);
    if (!linkBase) return NextResponse.json({ error: "Sem link do plano ativo em annual_promo" }, { status: 500 });
    const linkUrl = linkComUtm(linkBase, CAMPANHA_BASE);
    const totalDoPlano = titulos.size;

    const candidatas = [...porAluna.entries()].filter(([id, cursos]) => cursos.size >= MIN_CURSOS_BASE && !jaConvidada.has(id) && !comPlano.has(id)).map(([id]) => id);
    if (!candidatas.length) return NextResponse.json({ enviados: 0, motivo: "ninguém pendente" });

    const fila: { to: string; user_id: string; studentName: string; cursosQueTem: string[]; totalDoPlano: number; linkUrl: string }[] = [];
    for (let i = 0; i < candidatas.length; i += 300) {
      const { data } = await service.from("profiles").select("id, full_name, email, banned, email_prefs").in("id", candidatas.slice(i, i + 300));
      for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null; banned: boolean | null; email_prefs: Record<string, boolean> | null }[]) {
        if (!podeReceber(p, jaConvidada, comPlano).ok) continue;
        const cursos = [...(porAluna.get(p.id) ?? [])].map((c) => titulos.get(c)).filter((t): t is string => !!t);
        fila.push({ to: p.email!, user_id: p.id, studentName: p.full_name || "aluna", cursosQueTem: cursos.length ? cursos : ["cursos da Handify"], totalDoPlano, linkUrl });
      }
    }

    if (simular) return NextResponse.json({ simulacao: true, enviados: 0, naFila: fila.length, exemplo: fila[0]?.to });

    const { enviados, erro } = await sendPlanUpgradeEmailBatch(fila);
    const ok = new Set(enviados.map((e) => e.toLowerCase()));
    await registrarEnvios(
      service,
      CAMPANHA_BASE,
      fila.filter((f) => ok.has(f.to.toLowerCase())).map((f) => ({ user_id: f.user_id, email: f.to }))
    );

    console.log(`[campanha-completo] enviados ${enviados.length} de ${fila.length}${erro ? ` — parou em: ${erro}` : ""}`);
    return NextResponse.json({ enviados: enviados.length, naFila: fila.length, erro });
  } catch (e) {
    console.error("[campanha-completo]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
