import * as XLSX from "xlsx";
import * as path from "path";

const QUALIFYING_CODES = new Set([
  "4MJ9YD","R2JAJA","RW2MMP","4NYAEE","LPGKQ8","RKJWA8","L9QEPN"
]);

const KNOWN_OTHER = new Set(["LPAGXG", "LGBA36"]);

const VENDAS_FILES = [
  "C:/Users/Jessica Veiga/Downloads/vendas_15_07_2026.xlsx",
  "C:/Users/Jessica Veiga/Downloads/vendas_15_07_2026 (1).xlsx",
  "C:/Users/Jessica Veiga/Downloads/vendas_15_07_2026 (2).xlsx",
];
const PRODUTOS_FILE = "C:/Users/Jessica Veiga/Downloads/produtos_15_07_2026.xlsx";

// mapa SKU → code e code → nome
const skuToCode = new Map<string, string>();
const codeToName = new Map<string, string>();
const prodRows = XLSX.utils.sheet_to_json<Record<string, string>>(
  XLSX.readFile(PRODUTOS_FILE).Sheets[XLSX.readFile(PRODUTOS_FILE).SheetNames[0]],
  { defval: "" }
);
for (const r of prodRows) {
  const code = (r["Código"] ?? "").trim();
  const sku  = (r["SKU"] ?? r["Sku"] ?? "").trim();
  // tenta varias colunas de nome
  const name = (r["Nome"] ?? r["Produto"] ?? r["Descricao"] ?? r["Descrição"] ?? Object.values(r)[1] ?? "").trim();
  if (code && sku) { skuToCode.set(sku, code); codeToName.set(code, name); }
}

// agrupa por email
const candidates = new Map<string, Set<string>>();
for (const f of VENDAS_FILES) {
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
    XLSX.readFile(f).Sheets[XLSX.readFile(f).SheetNames[0]],
    { defval: "" }
  );
  for (const r of rows) {
    if ((r["Status Compra"] ?? "").trim() !== "Compra Aprovada") continue;
    if ((r["Status Pagamento"] ?? "").trim() !== "Pagamento Aprovado") continue;
    const email = (r["Email"] ?? "").trim().toLowerCase();
    if (!email) continue;
    const sku = (r["Sku"] ?? r["SKU"] ?? "").trim();
    const code = skuToCode.get(sku);
    if (!code) continue;
    if (!candidates.has(email)) candidates.set(email, new Set());
    candidates.get(email)!.add(code);
  }
}

// analisa excluidos
const codeFreq = new Map<string, number>();
const unexpected: Array<{ email: string; codes: string[]; unexpected: string[] }> = [];

for (const [email, codes] of candidates) {
  const codeArr = [...codes];
  if (codeArr.some(c => QUALIFYING_CODES.has(c))) continue; // qualificada

  for (const c of codeArr) {
    codeFreq.set(c, (codeFreq.get(c) ?? 0) + 1);
  }

  const unexp = codeArr.filter(c => !QUALIFYING_CODES.has(c) && !KNOWN_OTHER.has(c));
  if (unexp.length > 0) {
    unexpected.push({ email, codes: codeArr, unexpected: unexp });
  }
}

console.log("=== CODIGOS NOS EXCLUIDOS (frequencia) ===");
const sorted = [...codeFreq.entries()].sort((a, b) => b[1] - a[1]);
for (const [code, count] of sorted) {
  const name = codeToName.get(code) ?? "(nome nao encontrado)";
  const tag = KNOWN_OTHER.has(code) ? "[OUTRO ECOSISTEMA]" : "[INESPERADO]";
  console.log(`  ${tag}  ${code}  x${count}  --  ${name}`);
}

console.log(`\n=== EXCLUIDOS COM CODIGOS FORA DO ESPERADO: ${unexpected.length} ===`);
if (unexpected.length === 0) {
  console.log("  Nenhum -- todos os excluidos tem apenas LPAGXG e/ou LGBA36.");
} else {
  for (const l of unexpected) {
    console.log(`\n  EMAIL: ${l.email}`);
    console.log(`  TODOS OS CODIGOS: ${l.codes.join(", ")}`);
    console.log(`  INESPERADOS:      ${l.unexpected.join(", ")}`);
  }
}

console.log(`\nTotal candidatas processadas: ${candidates.size}`);
console.log(`Excluidas total: ${codeFreq.size > 0 ? [...candidates].filter(([,c]) => ![...c].some(x => QUALIFYING_CODES.has(x))).length : 0}`);
