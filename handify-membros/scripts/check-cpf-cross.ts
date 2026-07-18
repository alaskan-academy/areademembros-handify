/**
 * Cruza pelo CPF: leads excluídos que têm OBs de funnels Handify
 * mas não têm o produto principal. Verifica se o mesmo CPF aparece
 * em outra compra com código qualificante (email diferente).
 */
import * as XLSX from "xlsx";

const QUALIFYING_CODES = new Set([
  "4MJ9YD","R2JAJA","RW2MMP","4NYAEE","LPGKQ8","RKJWA8","L9QEPN"
]);

// OBs de funnels Handify que apareceram nos excluídos sem principal
const HANDIFY_OB_CODES = new Set([
  "47WBKG", // Pomadas Medicinais Original    (Velaroma/Workshop)
  "4M2WW6", // Saboaria Energética 2.0        (Saponaria)
  "4NGDDO", // Embalagens que Encantam 2.0    (Saponaria)
  "R36XPZ", // Natural Dermatológica 2.0      (Saponaria)
]);

const VENDAS_FILES = [
  "C:/Users/Jessica Veiga/Downloads/vendas_15_07_2026.xlsx",
  "C:/Users/Jessica Veiga/Downloads/vendas_15_07_2026 (1).xlsx",
  "C:/Users/Jessica Veiga/Downloads/vendas_15_07_2026 (2).xlsx",
];
const PRODUTOS_FILE = "C:/Users/Jessica Veiga/Downloads/produtos_15_07_2026.xlsx";

// mapa SKU → code e code → nome
const skuToCode = new Map<string, string>();
const codeToName = new Map<string, string>();
{
  const wb = XLSX.readFile(PRODUTOS_FILE);
  const rows = XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  for (const r of rows) {
    const code = (r["Código"] ?? "").trim();
    const sku  = (r["SKU"] ?? r["Sku"] ?? "").trim();
    const name = (Object.values(r)[1] as string ?? "").trim();
    if (code && sku) { skuToCode.set(sku, code); codeToName.set(code, name); }
  }
}

// Lê todas as linhas aprovadas com CPF
type Row = { email: string; cpf: string; code: string; nome: string };
const allRows: Row[] = [];

for (const f of VENDAS_FILES) {
  const wb = XLSX.readFile(f);
  const rows = XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  for (const r of rows) {
    if ((r["Status Compra"] ?? "").trim() !== "Compra Aprovada") continue;
    if ((r["Status Pagamento"] ?? "").trim() !== "Pagamento Aprovado") continue;
    const email = (r["Email"] ?? "").trim().toLowerCase();
    const cpf   = (r["Documento"] ?? "").replace(/\D/g, "").trim();
    const sku   = (r["Sku"] ?? r["SKU"] ?? "").trim();
    const code  = skuToCode.get(sku) ?? "";
    const nome  = (r["Cliente"] ?? "").trim();
    if (!email || !code) continue;
    allRows.push({ email, cpf, code, nome });
  }
}

// Agrupa por email → { codes, cpf }
const byEmail = new Map<string, { cpf: string; nome: string; codes: Set<string> }>();
for (const r of allRows) {
  if (!byEmail.has(r.email)) byEmail.set(r.email, { cpf: r.cpf, nome: r.nome, codes: new Set() });
  const e = byEmail.get(r.email)!;
  if (!e.cpf && r.cpf) e.cpf = r.cpf;
  e.codes.add(r.code);
}

// Identifica excluídos com OBs Handify
const targets: Array<{ email: string; cpf: string; nome: string; codes: string[]; obHandify: string[] }> = [];
for (const [email, data] of byEmail) {
  const codes = [...data.codes];
  if (codes.some(c => QUALIFYING_CODES.has(c))) continue; // qualificada — pula
  const obHandify = codes.filter(c => HANDIFY_OB_CODES.has(c));
  if (obHandify.length === 0) continue; // não tem OB Handify — pula
  targets.push({ email, cpf: data.cpf, nome: data.nome, codes, obHandify });
}

console.log(`Leads alvo (excluidos com OB Handify): ${targets.length}\n`);

// CPF → emails com código qualificante
const cpfToQualifyingEmails = new Map<string, Array<{ email: string; codes: string[] }>>();
for (const [email, data] of byEmail) {
  const codes = [...data.codes];
  if (!codes.some(c => QUALIFYING_CODES.has(c))) continue;
  const cpf = data.cpf;
  if (!cpf) continue;
  if (!cpfToQualifyingEmails.has(cpf)) cpfToQualifyingEmails.set(cpf, []);
  cpfToQualifyingEmails.get(cpf)!.push({ email, codes });
}

// Cruzamento
let encontrados = 0;
let semCpf = 0;
let semMatch = 0;

for (const t of targets) {
  console.log(`EMAIL: ${t.email}`);
  console.log(`  Nome : ${t.nome}`);
  console.log(`  CPF  : ${t.cpf || "(sem CPF no registro)"}`);
  console.log(`  OBs  : ${t.obHandify.map(c => `${c} (${codeToName.get(c) ?? c})`).join(", ")}`);
  console.log(`  Todos: ${t.codes.join(", ")}`);

  if (!t.cpf) {
    console.log(`  >> SEM CPF — nao e possivel cruzar`);
    semCpf++;
  } else {
    const matches = cpfToQualifyingEmails.get(t.cpf);
    if (matches && matches.length > 0) {
      console.log(`  >> ENCONTRADO com outro email:`);
      for (const m of matches) {
        const qualCodes = m.codes.filter(c => QUALIFYING_CODES.has(c));
        console.log(`     email: ${m.email}`);
        console.log(`     codigos qualificantes: ${qualCodes.map(c => `${c} (${codeToName.get(c) ?? c})`).join(", ")}`);
      }
      encontrados++;
    } else {
      console.log(`  >> NAO encontrado em outras compras — comprou so o OB`);
      semMatch++;
    }
  }
  console.log("");
}

console.log("=== RESUMO ===");
console.log(`Total alvos: ${targets.length}`);
console.log(`Com match por CPF (tem principal em outro email): ${encontrados}`);
console.log(`Sem CPF (nao da para cruzar): ${semCpf}`);
console.log(`Sem match (comprou so o OB, sem principal): ${semMatch}`);
