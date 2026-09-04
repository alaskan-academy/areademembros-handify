import { z } from "zod";

/**
 * Rótulo do sabonete (e de cosmético) — o que precisa constar, num formato
 * que cabe na etiqueta. Compartilhado entre a tela e o gerador do PDF; sem
 * banco: a aluna digita, vê a prévia e imprime.
 */

export const TAMANHOS = {
  p: { nome: "Pequeno", medida: "7 × 4 cm", uso: "mini sabonete, lembrancinha", w: 7, h: 4, fontes: { marca: 6.5, produto: 8.5, texto: 5.2 } },
  m: { nome: "Médio", medida: "9 × 5 cm", uso: "barra de 90 g", w: 9, h: 5, fontes: { marca: 7.5, produto: 10, texto: 6 } },
  g: { nome: "Grande", medida: "9 × 7 cm", uso: "pote, cosmético", w: 9, h: 7, fontes: { marca: 8.5, produto: 11.5, texto: 6.8 } },
} as const;

export type Tamanho = keyof typeof TAMANHOS;

/** Textos que a ANVISA pede e a aluna costuma não saber escrever — editáveis. */
export const PADRAO = {
  tipo: "Sabonete em barra",
  modoUso: "Aplique sobre a pele úmida, massageie e enxágue.",
  advertencias: "Uso externo. Evite contato com os olhos. Em caso de irritação, suspenda o uso. Mantenha fora do alcance de crianças.",
};

export const TIPOS_SUGERIDOS = [
  "Sabonete em barra",
  "Sabonete líquido",
  "Sabonete esfoliante",
  "Hidratante corporal",
  "Manteiga corporal",
  "Óleo corporal",
  "Escalda-pés",
  "Sal de banho",
  "Bálsamo labial",
];

export const rotuloSchema = z.object({
  marca: z.string().trim().max(60),
  produto: z.string().trim().min(1, "Dê nome ao produto").max(80),
  tipo: z.string().trim().max(60),
  peso: z.string().trim().max(20),
  ingredientes: z.string().trim().max(600),
  modoUso: z.string().trim().max(200),
  advertencias: z.string().trim().max(300),
  /** YYYY-MM-DD ou vazio. */
  fabricacao: z.string().trim().max(10),
  validade: z.string().trim().max(10),
  lote: z.string().trim().max(20),
  fabricante: z.string().trim().max(80),
  documento: z.string().trim().max(30),
  contato: z.string().trim().max(120),
  tamanho: z.enum(["p", "m", "g"]).default("m"),
  quantidade: z.number().int().min(1).max(100).default(10),
});

export type DadosRotulo = z.infer<typeof rotuloSchema>;

export function dadosVazios(): DadosRotulo {
  return {
    marca: "",
    produto: "",
    tipo: PADRAO.tipo,
    peso: "",
    ingredientes: "",
    modoUso: PADRAO.modoUso,
    advertencias: PADRAO.advertencias,
    fabricacao: "",
    validade: "",
    lote: "",
    fabricante: "",
    documento: "",
    contato: "",
    tamanho: "m",
    quantidade: 10,
  };
}

/** Quantos rótulos desse tamanho cabem numa folha A4 com margem de 1 cm e 0,2 cm entre eles. */
export function porFolha(t: Tamanho): number {
  const { w, h } = TAMANHOS[t];
  const util = { w: 21 - 2, h: 29.7 - 2 };
  const gap = 0.2;
  const cols = Math.max(1, Math.floor((util.w + gap) / (w + gap)));
  const rows = Math.max(1, Math.floor((util.h + gap) / (h + gap)));
  return cols * rows;
}

export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** As linhas do rótulo, na ordem em que vão para a etiqueta e para o "Copiar". */
export function linhasRotulo(d: DadosRotulo): { texto: string; papel: "marca" | "produto" | "texto" | "destaque" }[] {
  const linhas: { texto: string; papel: "marca" | "produto" | "texto" | "destaque" }[] = [];
  if (d.marca) linhas.push({ texto: d.marca, papel: "marca" });
  linhas.push({ texto: d.produto || "Nome do produto", papel: "produto" });
  const tipoPeso = [d.tipo, d.peso].filter(Boolean).join(" — ");
  if (tipoPeso) linhas.push({ texto: tipoPeso, papel: "texto" });
  if (d.ingredientes) linhas.push({ texto: `Ingredientes: ${d.ingredientes}`, papel: "texto" });
  if (d.modoUso) linhas.push({ texto: `Modo de uso: ${d.modoUso}`, papel: "texto" });
  if (d.advertencias) linhas.push({ texto: d.advertencias, papel: "texto" });
  const datas = [d.fabricacao && `Fabricação ${dataBR(d.fabricacao)}`, d.validade && `Validade ${dataBR(d.validade)}`, d.lote && `Lote ${d.lote}`].filter(Boolean).join(" | ");
  if (datas) linhas.push({ texto: datas, papel: "destaque" });
  const quem = [d.fabricante && `Fabricado por ${d.fabricante}`, d.documento, d.contato].filter(Boolean).join(" | ");
  if (quem) linhas.push({ texto: quem, papel: "texto" });
  return linhas;
}

export function textoRotulo(d: DadosRotulo): string {
  return linhasRotulo(d)
    .map((l) => l.texto)
    .join("\n");
}
