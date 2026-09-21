/**
 * Regera os PDFs dos certificados já emitidos, com a margem de segurança de
 * impressão.
 *
 * O PDF fica salvo no Storage no momento da emissão — corrigir o gerador só
 * vale para certificado novo. Os 247 já emitidos continuariam saindo cortados
 * na impressora, inclusive o da aluna que reclamou em 21/09/2026.
 *
 * O que NÃO muda: `verify_hash`, `issued_at` e o caminho no Storage. O QR e a
 * página /verificar/<hash> continuam valendo — regerar com hash novo
 * invalidaria certificado que já está impresso na parede de alguém.
 *
 * Não dispara e-mail: passa longe da camada de envio.
 *
 *   npx tsx scripts/regerar-certificados.ts            # só mostra o que faria
 *   npx tsx scripts/regerar-certificados.ts --aplicar  # grava
 */
import { createClient } from "@supabase/supabase-js";
import { generateCertificatePdf } from "../src/lib/certificate";
import { decryptCpf, formatCpf } from "../src/lib/cpf-crypto";

const APLICAR = process.argv.includes("--aplicar");

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type Linha = {
  id: string;
  user_id: string;
  verify_hash: string;
  issued_at: string;
  pdf_path: string | null;
  profiles: { full_name: string | null; cpf_encrypted: string | null } | null;
  courses: { title: string; workload_hours: number | null } | null;
};

async function main() {
  const db = service();

  // Paginado: o PostgREST corta em 1.000 linhas e são 247 hoje, mas o número
  // cresce toda semana.
  const todos: Linha[] = [];
  const PAGINA = 500;
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("certificates")
      .select("id, user_id, verify_hash, issued_at, pdf_path, profiles!user_id(full_name, cpf_encrypted), courses!course_id(title, workload_hours)")
      .order("issued_at", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as unknown as Linha[];
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }

  console.log(`${todos.length} certificado(s) encontrados.`);
  if (!APLICAR) {
    console.log("\nMODO SIMULAÇÃO — nada será gravado. Use --aplicar para valer.\n");
  }

  let ok = 0;
  let pulados = 0;
  const falhas: string[] = [];

  for (const cert of todos) {
    if (!cert.pdf_path || !cert.courses) {
      pulados++;
      continue;
    }

    let cpf: string | null = null;
    if (cert.profiles?.cpf_encrypted) {
      try {
        cpf = formatCpf(decryptCpf(cert.profiles.cpf_encrypted));
      } catch {
        // CPF não é obrigatório no certificado — segue sem ele.
      }
    }

    try {
      const pdf = await generateCertificatePdf({
        studentName: cert.profiles?.full_name ?? "Aluna Handify",
        cpf,
        courseTitle: cert.courses.title,
        workloadHours: cert.courses.workload_hours ?? 0,
        issuedAt: new Date(cert.issued_at),
        verifyHash: cert.verify_hash,
      });

      if (APLICAR) {
        const { error } = await db.storage
          .from("certificates")
          .upload(cert.pdf_path, pdf, { contentType: "application/pdf", upsert: true });
        if (error) throw new Error(error.message);
      }
      ok++;
      if (ok % 25 === 0) console.log(`  ... ${ok}/${todos.length}`);
    } catch (e) {
      falhas.push(`${cert.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n${APLICAR ? "Regerados" : "Seriam regerados"}: ${ok}`);
  if (pulados) console.log(`Pulados (sem pdf_path ou sem curso): ${pulados}`);
  if (falhas.length) {
    console.log(`Falhas: ${falhas.length}`);
    for (const f of falhas.slice(0, 10)) console.log("  -", f);
  }
  console.log("\nNenhum e-mail foi enviado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
