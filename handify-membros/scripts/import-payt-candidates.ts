/**
 * Importa alunas da Payt para migration_candidates.
 *
 * Uso:
 *   npx tsx scripts/import-payt-candidates.ts \
 *     --vendas caminho/vendas.xlsx \
 *     --produtos caminho/produtos.xlsx [--dry-run]
 *
 * O script:
 *   1. Lê o relatório de produtos → monta mapa: SKU → product_code
 *   2. Lê o relatório de vendas → filtra compras aprovadas
 *   3. Para cada compra, resolve o product_code via SKU
 *   4. Agrupa por e-mail (uma candidata por e-mail, vários product_codes)
 *   5. Faz upsert em migration_candidates (idempotente — pode rodar de novo)
 *
 * Segurança:
 *   - CPF armazenado em texto simples temporariamente (apagado após ativação)
 *   - Nenhum dado é enviado para fora do Supabase (service role local)
 */

import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Carrega .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Parsing de argumentos ────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const vendasPath = arg("vendas");
const produtosPath = arg("produtos");
const dryRun = process.argv.includes("--dry-run");

if (!vendasPath || !produtosPath) {
  console.error("Uso: npx tsx scripts/import-payt-candidates.ts --vendas <arquivo.xlsx> --produtos <arquivo.xlsx> [--dry-run]");
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
  // Se vier em CAIXA ALTA, converte para Title Case
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

// ─── Passo 1: mapa SKU → product_code (do arquivo de produtos) ───────────────

console.log(`\n📦 Lendo arquivo de produtos: ${produtosPath}`);
const produtosRows = readXlsx(produtosPath);

// Colunas do relatório de produtos: Código (A), SKU (F)
// SheetJS retorna por nome de header, não por letra
const skuToCode = new Map<string, string>();
let produtosIgnorados = 0;

for (const row of produtosRows) {
  const codigo = (row["Código"] ?? "").trim();
  const sku = (row["SKU"] ?? row["Sku"] ?? "").trim();

  if (!codigo || !sku) {
    produtosIgnorados++;
    continue;
  }
  skuToCode.set(sku, codigo);
}

console.log(`   ✅ ${skuToCode.size} produtos mapeados (${produtosIgnorados} ignorados por SKU/Código vazios)`);

// ─── Passo 2: ler vendas e agrupar por e-mail ─────────────────────────────────

console.log(`\n🛒 Lendo arquivo de vendas: ${vendasPath}`);
const vendasRows = readXlsx(vendasPath);

// Filtros de status (compra + pagamento aprovados)
const STATUS_COMPRA_OK = "Compra Aprovada";
const STATUS_PAGAMENTO_OK = "Pagamento Aprovado";

// Map: email → { full_name, cpf_raw, phone, product_codes: Set }
const candidates = new Map<string, {
  full_name: string;
  cpf_raw: string;
  phone: string;
  product_codes: Set<string>;
}>();

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

  if (!candidates.has(email)) {
    candidates.set(email, {
      full_name: fullName,
      cpf_raw: cpf,
      phone,
      product_codes: new Set(),
    });
  }

  const c = candidates.get(email)!;
  // Preenche dados ausentes sem sobrescrever já existentes
  if (!c.full_name && fullName) c.full_name = fullName;
  if (!c.cpf_raw && cpf) c.cpf_raw = cpf;
  if (!c.phone && phone) c.phone = phone;
  c.product_codes.add(productCode);

  vendasOk++;
}

console.log(`   ✅ ${vendasOk} vendas aprovadas processadas`);
console.log(`   ⏭️  ${vendasFiltradas} vendas ignoradas (status não aprovado ou sem e-mail)`);
console.log(`   ⚠️  ${vendaSemCurso} vendas sem product_code correspondente (produto não cadastrado na área de membros)`);
console.log(`\n👥 Total de candidatas únicas: ${candidates.size}`);

// ─── Passo 3: verificar quais product_codes existem nos cursos ───────────────

console.log("\n🔍 Verificando product_codes nos cursos...");
const { data: courses, error: coursesError } = await supabase
  .from("courses")
  .select("id, title, product_codes");

if (coursesError) {
  console.error("❌ Erro ao buscar cursos:", coursesError.message);
  process.exit(1);
}

// Mapa: product_code → course_id
const codeToCoursId = new Map<string, string>();
for (const course of courses ?? []) {
  for (const code of course.product_codes ?? []) {
    codeToCoursId.set(code, course.id);
  }
}

// Coletar product_codes sem curso correspondente (para log)
const unmappedCodes = new Set<string>();
for (const [, c] of candidates) {
  for (const code of c.product_codes) {
    if (!codeToCoursId.has(code)) {
      unmappedCodes.add(code);
    }
  }
}
if (unmappedCodes.size > 0) {
  console.log(`   ⚠️  ${unmappedCodes.size} product_codes sem curso na área de membros (serão ignorados na concessão de matrícula):`);
  for (const code of unmappedCodes) {
    console.log(`      - ${code}`);
  }
}

// ─── Passo 4: upsert em migration_candidates ─────────────────────────────────

if (dryRun) {
  console.log("\n🧪 DRY-RUN ativo — nenhum dado será gravado no banco.");
  console.log("\nPrimeiras 5 candidatas:");
  let i = 0;
  for (const [email, c] of candidates) {
    if (i++ >= 5) break;
    console.log(`  ${email} | ${c.full_name} | codes: ${[...c.product_codes].join(", ")}`);
  }
  console.log("\n✅ Simulação concluída.");
  process.exit(0);
}

console.log("\n📥 Inserindo candidatas no banco...");

const BATCH = 200;
const rows = [...candidates.entries()].map(([email, c]) => ({
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
      ignoreDuplicates: false, // atualiza product_codes se já existir
    });

  if (error) {
    console.error(`❌ Erro no batch ${Math.floor(i / BATCH) + 1}:`, error.message);
    errors += batch.length;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r   ${inserted}/${rows.length} candidatas inseridas...`);
  }
}

console.log(`\n\n✅ Importação concluída: ${inserted} candidatas inseridas/atualizadas, ${errors} erros.`);

if (errors > 0) {
  console.warn("⚠️  Houve erros — verifique os logs acima.");
  process.exit(1);
}
