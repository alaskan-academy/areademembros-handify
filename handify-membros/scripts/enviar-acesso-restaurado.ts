/**
 * Avisa as alunas que tiveram o acesso revogado por engano em 04–09/09/2026.
 *
 * NÃO ENVIA POR PADRÃO. Sem --enviar, monta a lista, confere o acesso de cada
 * uma e grava a prévia em HTML — que é o que a Jessica aprova antes.
 *
 *   npx tsx scripts/enviar-acesso-restaurado.ts                 # prévia, não envia
 *   npx tsx scripts/enviar-acesso-restaurado.ts --previa=x.html # onde salvar
 *   npx tsx scripts/enviar-acesso-restaurado.ts --para=a@b.com  # teste em 1 e-mail
 *   npx tsx scripts/enviar-acesso-restaurado.ts --enviar        # envia de verdade
 *
 * Trava: só envia para quem TEM o acesso ativo agora. Se alguma aluna estiver
 * com o curso ainda revogado, o script para e não envia para ninguém — mandar
 * "está tudo certo" para quem continua sem acesso seria pior que não mandar.
 */
import * as dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sendAccessRestoredEmail, renderAccessRestoredEmail } from "../src/lib/email";
dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const enviar = args.includes("--enviar");
const soPara = args.find((a) => a.startsWith("--para="))?.split("=")[1];
const arquivoPrevia = args.find((a) => a.startsWith("--previa="))?.split("=")[1];

type Linha = { user_id: string; email: string; nome: string; cursos: string[]; ativos: number; revogados: number };

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });


  // Quem foi restaurada, com os cursos e o estado atual da matrícula.
  const { data: restauradas, error: erro } = await s
    .from("audit_log")
    .select("meta")
    .eq("action", "enrollment.restored");
  if (erro) throw new Error(erro.message);

  const porAluna = new Map<string, Set<string>>();
  for (const r of restauradas ?? []) {
    const m = r.meta as { user_id?: string; course_id?: string };
    if (!m?.user_id || !m?.course_id) continue;
    if (!porAluna.has(m.user_id)) porAluna.set(m.user_id, new Set());
    porAluna.get(m.user_id)!.add(m.course_id);
  }

  const userIds = [...porAluna.keys()];
  const [{ data: perfis }, { data: cursos }, { data: matriculas }] = await Promise.all([
    s.from("profiles").select("id, email, full_name").in("id", userIds),
    s.from("courses").select("id, title"),
    s.from("enrollments").select("user_id, course_id, expires_at").in("user_id", userIds),
  ]);

  const perfilPor = new Map((perfis ?? []).map((p) => [p.id, p]));
  const tituloPor = new Map((cursos ?? []).map((c) => [c.id, c.title as string]));
  const agora = Date.now();
  const ativa = new Map<string, boolean>();
  for (const m of matriculas ?? []) {
    const viva = !m.expires_at || new Date(m.expires_at as string).getTime() > agora;
    ativa.set(`${m.user_id}|${m.course_id}`, viva);
  }

  const linhas: Linha[] = [];
  for (const [userId, courseIds] of porAluna) {
    const perfil = perfilPor.get(userId);
    if (!perfil?.email) continue;
    const ids = [...courseIds];
    linhas.push({
      user_id: userId,
      email: perfil.email,
      nome: perfil.full_name ?? "",
      cursos: ids.map((id) => tituloPor.get(id) ?? id).sort(),
      ativos: ids.filter((id) => ativa.get(`${userId}|${id}`) === true).length,
      revogados: ids.filter((id) => ativa.get(`${userId}|${id}`) !== true).length,
    });
  }
  linhas.sort((a, b) => a.nome.localeCompare(b.nome));

  console.log(`\n${linhas.length} alunas na lista\n`);
  for (const l of linhas) {
    const marca = l.revogados === 0 ? "ok  " : "FALTA";
    console.log(`  ${marca} ${l.nome.padEnd(46).slice(0, 46)} ${l.email.padEnd(34)} ${l.ativos} curso(s)`);
  }

  const pendentes = linhas.filter((l) => l.revogados > 0);
  if (pendentes.length) {
    console.error(
      `\n❌ ${pendentes.length} aluna(s) ainda com curso revogado. Nada foi enviado — resolver o acesso antes.`
    );
    process.exit(1);
  }
  console.log("\n✅ Todas com acesso ativo, nenhuma pendência.");

  if (arquivoPrevia) {
    const exemplo = linhas.find((l) => l.cursos.length > 1) ?? linhas[0];
    const { subject, html } = renderAccessRestoredEmail({ studentName: exemplo.nome, courseTitles: exemplo.cursos });
    writeFileSync(arquivoPrevia, html, "utf8");
    console.log(`Assunto: ${subject}`);
    console.log(`\nPrévia salva em ${arquivoPrevia} (exemplo: ${exemplo.nome}, ${exemplo.cursos.length} cursos)`);
  }

  if (!enviar) {
    console.log("\nNada enviado. Rode com --enviar quando aprovar.");
    return;
  }

  const destinos = soPara ? linhas.filter((l) => l.email.toLowerCase() === soPara.toLowerCase()) : linhas;
  console.log(`\nEnviando para ${destinos.length}...`);
  let ok = 0;
  const falhas: string[] = [];
  for (const l of destinos) {
    try {
      await sendAccessRestoredEmail({ to: l.email, studentName: l.nome, courseTitles: l.cursos });
      ok++;
      console.log(`  enviado ${l.email}`);
    } catch (e) {
      falhas.push(`${l.email}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`  FALHOU  ${l.email}`);
    }
  }
  console.log(`\n${ok} enviados, ${falhas.length} falhas`);
  for (const f of falhas) console.error("  " + f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
