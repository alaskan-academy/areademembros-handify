/**
 * Emite os certificados de quem já cumpriu o requisito e ficou sem.
 *
 * Existe porque o certificado só é gerado no momento em que uma aula é marcada
 * como concluída. Quando o limiar caiu de 95% para 90% (06/10/2026), 159 alunas
 * passaram a ter direito, mas nenhuma receberia nada até voltar e marcar outra
 * aula — e quem já terminou o curso não volta.
 *
 * NÃO ENVIA E-MAIL. `enviarEmail: false`, fixo no código: um retroativo manda
 * tudo de uma vez, e 159 e-mails simultâneos de "parabéns" para quem concluiu
 * meses atrás é enxame, não boa notícia. Elas encontram o certificado no perfil.
 *
 * NÃO EMITE POR PADRÃO. Sem --emitir só mostra a lista.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/emitir-certificados-pendentes.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/emitir-certificados-pendentes.ts --curso=<uuid>
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/emitir-certificados-pendentes.ts --emitir
 *
 * A régua de quem entra é `aulasNecessarias()`, a mesma de quem emite — nunca
 * uma cópia. Duas réguas foi o defeito que gerou este script.
 */
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { issueCertificateIfComplete, aulasNecessarias } from "../src/lib/certificates/issue";
dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const emitir = args.includes("--emitir");
const soCurso = args.find((a) => a.startsWith("--curso="))?.split("=")[1];

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Páginas de 1.000: o PostgREST corta aí, inclusive sem erro nenhum. */
async function todas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const fora: T[] = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await consulta(de, de + passo - 1);
    if (error) throw error;
    const lote = data ?? [];
    fora.push(...lote);
    if (lote.length < passo) return fora;
  }
}

async function main() {
  const { data: cursos, error } = await s
    .from("courses")
    .select("id, title, has_certificate, course_type")
    .eq("has_certificate", true)
    .eq("course_type", "course")
    .order("title");
  if (error) throw error;

  let totalPendentes = 0;
  let totalEmitidos = 0;
  let totalFalharam = 0;

  for (const curso of cursos ?? []) {
    if (soCurso && curso.id !== soCurso) continue;

    const { data: modulos } = await s
      .from("modules")
      .select("lessons(id, archived)")
      .eq("course_id", curso.id)
      .eq("archived", false);

    type AulaRef = { id: string; archived: boolean };
    const aulaIds =
      modulos?.flatMap((m) =>
        ((m.lessons as unknown as AulaRef[]) ?? []).filter((l) => !l.archived).map((l) => l.id)
      ) ?? [];
    if (!aulaIds.length) continue;

    const limiar = aulasNecessarias(aulaIds.length);

    // Ordem estável obrigatória: OFFSET sem ORDER BY não garante ordem no
    // Postgres, e aqui linha repetida inflaria a contagem de quem está a uma
    // aula do limiar, enquanto linha pulada apagaria quem já concluiu.
    const [matriculas, progresso, certificados] = await Promise.all([
      todas<{ user_id: string }>((de, ate) =>
        s.from("enrollments").select("user_id").eq("course_id", curso.id)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("id", { ascending: true }).range(de, ate)
      ),
      todas<{ user_id: string }>((de, ate) =>
        s.from("lesson_progress").select("user_id").eq("completed", true)
          .in("lesson_id", aulaIds)
          .order("id", { ascending: true }).range(de, ate)
      ),
      todas<{ user_id: string }>((de, ate) =>
        s.from("certificates").select("user_id").eq("course_id", curso.id)
          .order("id", { ascending: true }).range(de, ate)
      ),
    ]);

    const feitas = new Map<string, number>();
    for (const { user_id } of progresso) feitas.set(user_id, (feitas.get(user_id) ?? 0) + 1);
    const jaTem = new Set(certificados.map((c) => c.user_id));

    const pendentes = [...new Set(matriculas.map((m) => m.user_id))].filter(
      (id) => !jaTem.has(id) && (feitas.get(id) ?? 0) >= limiar
    );

    totalPendentes += pendentes.length;
    console.log(
      `${curso.title.padEnd(42)} ${String(aulaIds.length).padStart(3)} aulas  ` +
      `exige ${String(limiar).padStart(3)}  pendentes: ${String(pendentes.length).padStart(4)}`
    );
    if (!pendentes.length || !emitir) continue;

    // Em série: cada emissão gera um PDF e sobe para o Storage.
    for (const userId of pendentes) {
      const ok = await issueCertificateIfComplete(userId, curso.id, { enviarEmail: false }).catch(
        (err) => {
          console.error(`  falhou ${userId}:`, err);
          return false;
        }
      );
      if (ok) totalEmitidos++;
      else totalFalharam++;
    }
    console.log(`  -> emitidos ate aqui: ${totalEmitidos}, falharam: ${totalFalharam}`);
  }

  console.log(`\npendentes: ${totalPendentes}`);
  if (emitir) console.log(`emitidos: ${totalEmitidos}  falharam: ${totalFalharam}  e-mails enviados: 0`);
  else console.log("nada foi emitido. rode com --emitir para valer.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
