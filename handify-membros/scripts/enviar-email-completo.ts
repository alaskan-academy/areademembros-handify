/**
 * Campanha do Handify Completo — disparo em lotes, com trava.
 *
 * Por padrão NÃO envia nada: só mostra o segmento e um exemplo. Enviar exige
 * `--enviar` escrito na mão. Quem já recebeu fica em `email_campaign_sends`,
 * então rodar de novo continua de onde parou, sem repetir.
 *
 *   npx tsx scripts/enviar-email-completo.ts                      # só mostra (padrão)
 *   npx tsx scripts/enviar-email-completo.ts --para eu@handify.com.br --enviar
 *   npx tsx scripts/enviar-email-completo.ts --limite 30 --enviar  # primeiro lote
 *   npx tsx scripts/enviar-email-completo.ts --enviar              # o resto
 *
 * Segmento: 4 ou mais cursos, sem Handify Completo ativo, não banida e que não
 * pediu para parar de receber (`email_prefs.news_post`).
 */
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

import { renderPlanUpgradeEmail, sendPlanUpgradeEmail } from "../src/lib/email";

const CAMPANHA = "plano-completo-base"; // mesma do cron de segunda — o guarda é compartilhado
const MIN_CURSOS = 4;
const PAUSA_MS = 600; // ~1,6 e-mails por segundo, dentro do limite do Resend

const args = process.argv.slice(2);
const temFlag = (f: string) => args.includes(f);
const valor = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const enviar = temFlag("--enviar");
const limite = Number(valor("--limite") ?? 0) || null;
const soPara = valor("--para");

function env(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Falta a variável ${nome} no .env.local`);
  return v;
}

async function main() {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  const [{ data: promo }, { data: cursosPlano }, { data: enviados }] = await Promise.all([
    supabase.from("annual_promo").select("link_url").eq("active", true).maybeSingle(),
    supabase.from("courses").select("id, title").eq("in_plan", true),
    supabase.from("email_campaign_sends").select("user_id").eq("campaign", CAMPANHA),
  ]);
  const linkBase = promo?.link_url;
  if (!linkBase) throw new Error("Sem link do plano ativo em annual_promo — configure no admin antes.");
  // Mesmo checkout do admin, com UTM próprio do e-mail: dá para separar no
  // relatório quem veio da campanha e quem veio do botão dentro da plataforma.
  const linkUrl = (() => {
    try {
      const u = new URL(linkBase);
      u.searchParams.set("utm_source", "email");
      u.searchParams.set("utm_medium", "email");
      u.searchParams.set("utm_campaign", "handifycompleto");
      u.searchParams.set("utm_content", CAMPANHA);
      return u.toString();
    } catch {
      return linkBase;
    }
  })();
  const totalDoPlano = (cursosPlano ?? []).length;
  const jaRecebeu = new Set((enviados ?? []).map((e) => e.user_id as string));

  // Matrículas válidas + perfis, em páginas (o banco tem milhares de linhas).
  const agora = new Date().toISOString();
  const matriculas: { user_id: string; course_id: string }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("enrollments")
      .select("user_id, course_id")
      .or(`expires_at.is.null,expires_at.gt.${agora}`)
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    matriculas.push(...((data ?? []) as { user_id: string; course_id: string }[]));
    if ((data ?? []).length < 1000) break;
  }

  const titulos = new Map((cursosPlano ?? []).map((c) => [c.id as string, c.title as string]));
  const porAluna = new Map<string, Set<string>>();
  for (const m of matriculas) {
    if (!porAluna.has(m.user_id)) porAluna.set(m.user_id, new Set());
    porAluna.get(m.user_id)!.add(m.course_id);
  }
  const candidatas = [...porAluna.entries()].filter(([, cursos]) => cursos.size >= MIN_CURSOS).map(([id]) => id);

  // Quem tem Completo ativo — uma consulta só (não vale confiar em RPC por aluna).
  const { data: ativas, error: erroMembership } = await supabase
    .from("memberships")
    .select("user_id, expires_at, revoked_at")
    .eq("plan", "completo")
    .is("revoked_at", null);
  if (erroMembership) throw new Error(`Não deu para ler memberships: ${erroMembership.message}`);
  const comPlano = new Set(
    (ativas ?? [])
      .filter((m) => !m.expires_at || new Date(m.expires_at as string) > new Date())
      .map((m) => m.user_id as string)
  );

  const perfis: { id: string; full_name: string | null; email: string | null; banned: boolean | null; email_prefs: Record<string, boolean> | null }[] = [];
  for (let i = 0; i < candidatas.length; i += 300) {
    const { data, error } = await supabase.from("profiles").select("id, full_name, email, banned, email_prefs").in("id", candidatas.slice(i, i + 300));
    if (error) throw new Error(error.message);
    perfis.push(...((data ?? []) as typeof perfis));
  }

  // Quem sai da lista, e por quê — para conferir antes de disparar.
  const motivos = { semEmail: 0, banida: 0, optOut: 0, comPlano: 0, jaRecebeu: 0 };
  const alvo: { id: string; nome: string; email: string; cursos: string[] }[] = [];
  for (const p of perfis) {
    if (!p.email) { motivos.semEmail++; continue; }
    if (p.banned) { motivos.banida++; continue; }
    if (p.email_prefs?.news_post === false) { motivos.optOut++; continue; }
    if (jaRecebeu.has(p.id)) { motivos.jaRecebeu++; continue; }
    if (comPlano.has(p.id)) { motivos.comPlano++; continue; }
    const cursos = [...(porAluna.get(p.id) ?? [])].map((c) => titulos.get(c)).filter((t): t is string => !!t);
    alvo.push({ id: p.id, nome: p.full_name || "aluna", email: p.email, cursos: cursos.length ? cursos : ["cursos da Handify"] });
  }

  const fila = soPara ? alvo.filter((a) => a.email.toLowerCase() === soPara.toLowerCase()) : limite ? alvo.slice(0, limite) : alvo;

  console.log(`\nCampanha: ${CAMPANHA}`);
  console.log(`Plano com ${totalDoPlano} cursos`);
  console.log(`Botão do e-mail vai para: ${linkUrl}`);
  console.log(`Candidatas com ${MIN_CURSOS}+ cursos: ${candidatas.length}`);
  console.log(`Fora: ${motivos.jaRecebeu} já receberam, ${motivos.comPlano} já têm o plano, ${motivos.optOut} pediram para não receber, ${motivos.banida} banidas, ${motivos.semEmail} sem e-mail`);
  console.log(`Para enviar agora: ${fila.length}${limite ? ` (limite ${limite})` : ""}${soPara ? ` (só ${soPara})` : ""}`);

  if (fila.length === 0) {
    console.log("\nNada a enviar.");
    return;
  }

  const exemplo = renderPlanUpgradeEmail({ studentName: fila[0].nome, cursosQueTem: fila[0].cursos, totalDoPlano, linkUrl });
  console.log(`\nExemplo (${fila[0].email}): "${exemplo.subject}"`);

  if (!enviar) {
    console.log("\nModo de conferência: NADA foi enviado.");
    console.log("Para enviar de verdade, rode de novo com --enviar (comece com --limite 30).\n");
    return;
  }

  console.log(`\nEnviando para ${fila.length}…`);
  let ok = 0;
  for (const a of fila) {
    try {
      await sendPlanUpgradeEmail({ to: a.email, studentName: a.nome, cursosQueTem: a.cursos, totalDoPlano, linkUrl });
      await supabase.from("email_campaign_sends").insert({ campaign: CAMPANHA, user_id: a.id, email: a.email });
      ok++;
      if (ok % 25 === 0) console.log(`  ${ok}/${fila.length}…`);
    } catch (e) {
      console.error(`  falhou para ${a.email}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, PAUSA_MS));
  }
  console.log(`\nEnviados: ${ok} de ${fila.length}. Registrados em email_campaign_sends.\n`);
}

main().catch((e) => {
  console.error("\nErro:", e.message, "\n");
  process.exit(1);
});
