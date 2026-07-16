/**
 * Importa alunas da Payt para migration_candidates.
 *
 * Uso:
 *   npx tsx scripts/import-payt-candidates.ts \
 *     --vendas vendas1.xlsx --vendas vendas2.xlsx --vendas vendas3.xlsx \
 *     --produtos produtos.xlsx [--dry-run]
 *
 * O script:
 *   1. Lê o relatório de produtos → monta mapa: SKU → product_code
 *   2. Lê TODOS os arquivos de vendas (múltiplos --vendas) → filtra compras aprovadas
 *   3. Para cada compra, resolve o product_code via SKU
 *   4. Agrupa por e-mail (uma candidata por e-mail, vários product_codes)
 *   5. Filtra: só entra quem comprou pelo menos 1 dos cursos principais Handify
 *   6. Faz upsert em migration_candidates (idempotente — pode rodar de novo)
 *
 * Cursos qualificantes (quem comprou pelo menos 1 entra):
 *   4MJ9YD  Fábrica das Velas de Lembrancinha
 *   R2JAJA  Workshop Buquê de Velas
 *   RW2MMP  Saponaria Brasil
 *   4NYAEE  Velaroma Artesanal
 *   LPGKQ8  Handify Artesanato Completo (bundle com todos os principais)
 *   RKJWA8  Combo Saponaria + Velaroma
 *   L9QEPN  Kit Completo (Fábrica + Workshop)
 */

import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Códigos que qualificam uma aluna para a migração.
// Deve ter comprado pelo menos 1 destes para entrar na área de membros.
const QUALIFYING_CODES = new Set([
  "4MJ9YD", // Fábrica das Velas de Lembrancinha
  "R2JAJA", // Workshop Buquê de Velas
  "RW2MMP", // Saponaria Brasil
  "4NYAEE", // Velaroma Artesanal
  "LPGKQ8", // Handify Artesanato Completo (bundle)
  "RKJWA8", // Combo Saponaria + Velaroma
  "L9QEPN", // Kit Completo (Fábrica + Workshop)
]);

// Adições manuais: OBs comprados com e-mail diferente do cadastro principal.
// Cruzamento por CPF confirmou que estas alunas têm o curso principal em outro e-mail.
const MANUAL_EXTRA_CODES: Record<string, string[]> = {
  "jeanine39lins@gmail.com":    ["4M2WW6"], // Saboaria Energética 2.0 (comprado em jeanine_peixoto@hotmail.com)
  "rmk_30@hotmail.com":         ["4M2WW6"], // Saboaria Energética 2.0 (comprado em marciakazahaya@gmail.com)
  "josanamil@gmail.com":        ["R36XPZ"], // Natural Dermatológica 2.0 (comprado em josanam@gmail.com)
  "katya.lichti@uol.com.br":    ["4NGDDO"], // Embalagens que Encantam 2.0 (comprado em katya.lichti@gmail.com)
};

// ─── Parsing de argumentos ────────────────────────────────────────────────────

function args(name: string): string[] {
  const result: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` && i + 1 < argv.length) {
      result.push(argv[i + 1]);
    }
  }
  return result;
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const vendasPaths = args("vendas");
const produtosPath = arg("produtos");
const dryRun = process.argv.includes("--dry-run");

if (vendasPaths.length === 0 || !produtosPath) {
  console.error(
    "Uso: npx tsx scripts/import-payt-candidates.ts \\\n" +
    "  --vendas vendas1.xlsx [--vendas vendas2.xlsx ...] \\\n" +
    "  --produtos produtos.xlsx [--dry-run]"
  );
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readXlsx(filePath: string): Record<string, string>[] {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`❌ Arquivo não encontrado: ${abs}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(abs, { type: "file", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
}

function normalizeName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").trim();
}

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "").trim();
}

// ─── Passo 1: mapa SKU → product_code ────────────────────────────────────────

console.log(`\n📦 Lendo arquivo de produtos: ${produtosPath}`);
const produtosRows = readXlsx(produtosPath);

const skuToCode = new Map<string, string>();
let produtosIgnorados = 0;

for (const row of produtosRows) {
  const codigo = (row["Código"] ?? "").trim();
  const sku = (row["SKU"] ?? row["Sku"] ?? "").trim();
  if (!codigo || !sku) { produtosIgnorados++; continue; }
  skuToCode.set(sku, codigo);
}

console.log(`   ✅ ${skuToCode.size} produtos mapeados (${produtosIgnorados} ignorados por SKU/Código vazios)`);

// ─── Passo 2: ler todos os arquivos de vendas e agrupar por e-mail ────────────

// Map: email → { full_name, cpf_raw, phone, product_codes: Set }
const allCandidates = new Map<string, {
  full_name: string;
  cpf_raw: string;
  phone: string;
  product_codes: Set<string>;
}>();

let totalVendasOk = 0;
let totalVendasFiltradas = 0;
let totalVendaSemCurso = 0;

const STATUS_COMPRA_OK = "Compra Aprovada";
const STATUS_PAGAMENTO_OK = "Pagamento Aprovado";

for (const vendasPath of vendasPaths) {
  console.log(`\n🛒 Lendo arquivo de vendas: ${vendasPath}`);
  const vendasRows = readXlsx(vendasPath);

  let vendasOk = 0;
  let vendasFiltradas = 0;
  let vendaSemCurso = 0;

  for (const row of vendasRows) {
    const statusCompra = (row["Status Compra"] ?? "").trim();
    const statusPagamento = (row["Status Pagamento"] ?? "").trim();

    if (statusCompra !== STATUS_COMPRA_OK || statusPagamento !== STATUS_PAGAMENTO_OK) {
      vendasFiltradas++;
      continue;
    }

    const email = (row["Email"] ?? "").trim().toLowerCase();
    if (!email) { vendasFiltradas++; continue; }

    const sku = (row["Sku"] ?? row["SKU"] ?? "").trim();
    const productCode = sku ? skuToCode.get(sku) : undefined;

    if (!productCode) {
      vendaSemCurso++;
      continue;
    }

    const fullName = normalizeName(row["Cliente"] ?? "");
    const cpf = normalizeCpf(row["Documento"] ?? "");
    const phone = normalizePhone(row["Telefone"] ?? "");

    if (!allCandidates.has(email)) {
      allCandidates.set(email, {
        full_name: fullName,
        cpf_raw: cpf,
        phone,
        product_codes: new Set(),
      });
    }

    const c = allCandidates.get(email)!;
    if (!c.full_name && fullName) c.full_name = fullName;
    if (!c.cpf_raw && cpf) c.cpf_raw = cpf;
    if (!c.phone && phone) c.phone = phone;
    c.product_codes.add(productCode);
    vendasOk++;
  }

  console.log(`   ✅ ${vendasOk} vendas aprovadas`);
  console.log(`   ⏭️  ${vendasFiltradas} ignoradas (status não aprovado ou sem e-mail)`);
  console.log(`   ⚠️  ${vendaSemCurso} sem product_code correspondente (produto não mapeado)`);

  totalVendasOk += vendasOk;
  totalVendasFiltradas += vendasFiltradas;
  totalVendaSemCurso += vendaSemCurso;
}

console.log(`\n📊 Totais consolidados de todos os arquivos:`);
console.log(`   Vendas aprovadas processadas: ${totalVendasOk}`);
console.log(`   Ignoradas (status/email): ${totalVendasFiltradas}`);
console.log(`   Sem product_code: ${totalVendaSemCurso}`);
console.log(`   Candidatas únicas (antes do filtro): ${allCandidates.size}`);

// ─── Passo 3: filtro de qualificação ──────────────────────────────────────────

console.log(`\n🔎 Aplicando filtro: precisa ter comprado pelo menos 1 curso principal...`);

const qualified = new Map<string, typeof allCandidates extends Map<string, infer V> ? V : never>();
const excluded: Array<{ email: string; codes: string[] }> = [];
const onlySupplementary: Array<{ email: string; codes: string[] }> = [];

for (const [email, c] of allCandidates) {
  const codes = [...c.product_codes];
  const hasQualifying = codes.some((code) => QUALIFYING_CODES.has(code));

  if (hasQualifying) {
    // Aplica adições manuais (OBs confirmados por cruzamento de CPF)
    const extras = MANUAL_EXTRA_CODES[email];
    if (extras) {
      for (const code of extras) c.product_codes.add(code);
    }
    qualified.set(email, c);
  } else {
    excluded.push({ email, codes });
    // "Só comprou complementares" = tem codes no banco mas nenhum é principal
    onlySupplementary.push({ email, codes });
  }
}

console.log(`   ✅ Qualificadas (entram na migração): ${qualified.size}`);
console.log(`   ❌ Excluídas (sem curso principal): ${excluded.length}`);

if (onlySupplementary.length > 0) {
  // Salva lista de excluídos em arquivo para não estourar o terminal
  const excludedReport = onlySupplementary
    .map(({ email, codes }) => `${email}\t${codes.join(", ")}`)
    .join("\n");
  const reportPath = path.resolve(process.cwd(), "excluded-candidates.txt");
  fs.writeFileSync(reportPath, `email\tcodigos\n${excludedReport}`, "utf-8");
  console.log(`\n⚠️  ${onlySupplementary.length} excluídas salvas em: ${reportPath}`);
}

// ─── Passo 4 e 5: async (supabase) ────────────────────────────────────────────

void (async () => {

console.log("\n🔍 Verificando product_codes nos cursos...");
const { data: courses, error: coursesError } = await supabase
  .from("courses")
  .select("id, title, product_codes");

if (coursesError) {
  console.error("❌ Erro ao buscar cursos:", coursesError.message);
  process.exit(1);
}

const codeToCoursId = new Map<string, string>();
for (const course of courses ?? []) {
  for (const code of course.product_codes ?? []) {
    codeToCoursId.set(code, course.id);
  }
}

const unmappedCodes = new Set<string>();
for (const [, c] of qualified) {
  for (const code of c.product_codes) {
    if (!codeToCoursId.has(code)) {
      unmappedCodes.add(code);
    }
  }
}
if (unmappedCodes.size > 0) {
  console.log(`   ⚠️  ${unmappedCodes.size} product_codes sem curso no banco (serão ignorados na matrícula):`);
  for (const code of unmappedCodes) {
    console.log(`      - ${code}`);
  }
}

// ─── Passo 5: upsert em migration_candidates ──────────────────────────────────

if (dryRun) {
  console.log("\n🧪 DRY-RUN ativo — nenhum dado será gravado no banco.");
  console.log("\nPrimeiras 5 candidatas qualificadas:");
  let i = 0;
  for (const [email, c] of qualified) {
    if (i++ >= 5) break;
    console.log(`  ${email} | ${c.full_name} | codes: ${[...c.product_codes].join(", ")}`);
  }
  console.log(`\n✅ Simulação concluída. ${qualified.size} candidatas seriam importadas.`);
  process.exit(0);
}

console.log(`\n📥 Inserindo ${qualified.size} candidatas no banco...`);

const BATCH = 200;
const rows = [...qualified.entries()].map(([email, c]) => ({
  email,
  full_name: c.full_name || null,
  cpf_raw: c.cpf_raw || null,
  phone: c.phone || null,
  product_codes: [...c.product_codes],
}));

let inserted = 0;
let errors = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase
    .from("migration_candidates")
    .upsert(batch, {
      onConflict: "email",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error(`❌ Erro no batch ${Math.floor(i / BATCH) + 1}:`, error.message);
    errors += batch.length;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r   ${inserted}/${rows.length} candidatas inseridas...`);
  }
}

console.log(`\n\n✅ Importação concluída!`);
console.log(`   Inseridas/atualizadas: ${inserted}`);
console.log(`   Erros: ${errors}`);
console.log(`   Excluídas por falta de curso principal: ${excluded.length}`);

if (onlySupplementary.length > 0) {
  console.log(`\n⚠️  Lembre-se: ${onlySupplementary.length} e-mail(s) tinham compras mapeadas mas ficaram de fora.`);
  console.log(`   Revise a lista acima se quiser decidir o que fazer com eles.`);
}

if (errors > 0) {
  console.warn("\n⚠️  Houve erros — verifique os logs acima.");
  process.exit(1);
}

})();
