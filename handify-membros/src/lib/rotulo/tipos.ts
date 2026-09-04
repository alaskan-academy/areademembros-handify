import { z } from "zod";

/**
 * Rótulo do sabonete (e de cosmético) — o que precisa constar, num formato
 * que cabe na etiqueta e com cara de produto de verdade. Compartilhado entre a
 * tela e o gerador do PDF; sem banco: a aluna digita, vê a prévia e imprime.
 */

export const PALETA = [
  { nome: "Lavanda", hex: "#8E7CC3" },
  { nome: "Sálvia", hex: "#7FA37A" },
  { nome: "Terracota", hex: "#C4704F" },
  { nome: "Rosa antigo", hex: "#C98B8B" },
  { nome: "Petróleo", hex: "#3F6F75" },
  { nome: "Dourado", hex: "#B8963E" },
  { nome: "Carvão", hex: "#3A3A3A" },
  { nome: "Marinho", hex: "#2E4057" },
];

export const ESTILOS = {
  classico: { nome: "Clássico", desc: "moldura dupla, nome em serifa" },
  moderno: { nome: "Moderno", desc: "faixa colorida no topo, letra reta" },
  delicado: { nome: "Delicado", desc: "fundo suave, divisória com ponto" },
} as const;
export type Estilo = keyof typeof ESTILOS;
export type Forma = "retangular" | "redondo";

/** Tamanhos prontos — a aluna pode digitar o dela. */
export const PRESETS: { nome: string; forma: Forma; largura: number; altura: number; uso: string }[] = [
  { nome: "Mini", forma: "retangular", largura: 7, altura: 4, uso: "lembrancinha" },
  { nome: "Barra", forma: "retangular", largura: 9, altura: 5, uso: "sabonete de 90 g" },
  { nome: "Pote", forma: "retangular", largura: 9, altura: 7, uso: "cosmético" },
  { nome: "Tampa 5 cm", forma: "redondo", largura: 5, altura: 5, uso: "tampa pequena" },
  { nome: "Tampa 7 cm", forma: "redondo", largura: 7, altura: 7, uso: "tampa de pote" },
];

/** Sabonete e cosmético seguem a ANVISA; vela segue os avisos de segurança. */
export type Familia = "cosmetico" | "vela";

export const FAMILIAS: { key: Familia; nome: string; emoji: string; categorias: string[]; cursos: string }[] = [
  { key: "cosmetico", nome: "Sabonete ou cosmético", emoji: "🧼", categorias: ["saboaria-artesanal", "cosmeticos-artesanais"], cursos: "Saboaria ou Cosméticos" },
  { key: "vela", nome: "Vela", emoji: "🕯️", categorias: ["velas-artesanais", "aromas-e-casa"], cursos: "Velas ou Aromas e Casa" },
];

export function familiasLiberadas(categorias: string[], tudo: boolean): Familia[] {
  return FAMILIAS.filter((f) => tudo || f.categorias.some((c) => categorias.includes(c))).map((f) => f.key);
}

/** Textos que a aluna costuma não saber escrever — já vêm prontos, editáveis. */
export const PADRAO: Record<Familia, { tipo: string; modoUso: string; advertencias: string }> = {
  cosmetico: {
    tipo: "Sabonete em barra",
    modoUso: "Aplique sobre a pele úmida, massageie e enxágue.",
    advertencias: "Uso externo. Evite contato com os olhos. Em caso de irritação, suspenda o uso. Mantenha fora do alcance de crianças.",
  },
  vela: {
    tipo: "Vela aromática",
    modoUso: "Na primeira vez, deixe acesa até a cera derreter até a borda. Apare o pavio a 5 mm antes de cada uso.",
    advertencias: "Nunca deixe a vela acesa sem supervisão. Mantenha longe de crianças, animais, cortinas e correntes de ar. Queime no máximo 4 horas por vez. Não mova a vela acesa. Apague antes de a cera acabar.",
  },
};

export const TIPOS_SUGERIDOS: Record<Familia, string[]> = {
  cosmetico: ["Sabonete em barra", "Sabonete líquido", "Sabonete esfoliante", "Hidratante corporal", "Manteiga corporal", "Óleo corporal", "Escalda-pés", "Sal de banho", "Bálsamo labial"],
  vela: ["Vela aromática", "Vela em pote", "Vela de massagem", "Vela decorativa", "Difusor de varetas", "Home spray"],
};

/** Rótulos de texto que mudam com a família (a vela não tem "ingredientes", tem composição). */
export const ROTULOS_CAMPOS: Record<Familia, { ingredientes: string; ingredientesAjuda: string; ingredientesExemplo: string; modoUso: string; conteudoExemplo: string }> = {
  cosmetico: {
    ingredientes: "Ingredientes",
    ingredientesAjuda: "Do maior para o menor. Se souber o nome INCI (está na embalagem do insumo), use — a ANVISA pede assim.",
    ingredientesExemplo: "Ex.: Sodium Palmate, Glycerin, Aqua, Parfum, Lavandula Angustifolia Oil, CI 77007",
    modoUso: "Modo de uso",
    conteudoExemplo: "Ex.: 90 g",
  },
  vela: {
    ingredientes: "Composição",
    ingredientesAjuda: "Cera, essência e pavio. Se quiser, o tempo de queima vai em Conteúdo.",
    ingredientesExemplo: "Ex.: Cera de soja, essência de lavanda, pavio de algodão",
    modoUso: "Como usar",
    conteudoExemplo: "Ex.: 200 g — 40 h de queima",
  },
};

export const LIMITES = { largura: { min: 3, max: 19 }, altura: { min: 2, max: 27.7 } };

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
  familia: z.enum(["cosmetico", "vela"]).default("cosmetico"),
  forma: z.enum(["retangular", "redondo"]).default("retangular"),
  estilo: z.enum(["classico", "moderno", "delicado"]).default("classico"),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default(PALETA[0].hex),
  largura: z.number().min(LIMITES.largura.min, "Largura mínima 3 cm").max(LIMITES.largura.max, "Largura máxima 19 cm (folha A4)"),
  altura: z.number().min(LIMITES.altura.min, "Altura mínima 2 cm").max(LIMITES.altura.max, "Altura máxima 27,7 cm (folha A4)"),
  quantidade: z.number().int().min(1).max(100).default(10),
});

export type DadosRotulo = z.infer<typeof rotuloSchema>;

export function dadosVazios(familia: Familia = "cosmetico"): DadosRotulo {
  return {
    marca: "",
    produto: "",
    tipo: PADRAO[familia].tipo,
    peso: "",
    ingredientes: "",
    modoUso: PADRAO[familia].modoUso,
    advertencias: PADRAO[familia].advertencias,
    familia,
    fabricacao: "",
    validade: "",
    lote: "",
    fabricante: "",
    documento: "",
    contato: "",
    forma: "retangular",
    estilo: "classico",
    cor: PALETA[0].hex,
    largura: 9,
    altura: 5,
    quantidade: 10,
  };
}

/** Quantos cabem numa folha A4 com margem de 1 cm e 0,2 cm entre eles. */
export function porFolha(largura: number, altura: number): number {
  const util = { w: 21 - 2, h: 29.7 - 2 };
  const gap = 0.2;
  const cols = Math.max(1, Math.floor((util.w + gap) / (largura + gap)));
  const rows = Math.max(1, Math.floor((util.h + gap) / (altura + gap)));
  return cols * rows;
}

/** Tamanhos de letra (pt) proporcionais ao lado menor da etiqueta. */
export function fontes(largura: number, altura: number, forma: Forma): { marca: number; produto: number; texto: number } {
  const menor = Math.min(largura, altura);
  const texto = Math.min(7.2, Math.max(4.8, menor * (forma === "redondo" ? 1.0 : 1.15)));
  return { marca: texto * 1.15, produto: texto * 1.75, texto };
}

export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export type Papel = "marca" | "produto" | "tipo" | "texto" | "destaque" | "quem";

/** As linhas do rótulo, na ordem em que vão para a etiqueta e para o "Copiar". */
export function linhasRotulo(d: DadosRotulo): { texto: string; papel: Papel }[] {
  const linhas: { texto: string; papel: Papel }[] = [];
  if (d.marca) linhas.push({ texto: d.marca, papel: "marca" });
  linhas.push({ texto: d.produto || "Nome do produto", papel: "produto" });
  const tipoPeso = [d.tipo, d.peso].filter(Boolean).join(" — ");
  if (tipoPeso) linhas.push({ texto: tipoPeso, papel: "tipo" });
  const r = ROTULOS_CAMPOS[d.familia];
  if (d.ingredientes) linhas.push({ texto: `${r.ingredientes}: ${d.ingredientes}`, papel: "texto" });
  if (d.modoUso) linhas.push({ texto: `${r.modoUso}: ${d.modoUso}`, papel: "texto" });
  if (d.advertencias) linhas.push({ texto: d.advertencias, papel: "texto" });
  const datas = [d.fabricacao && `Fabricação ${dataBR(d.fabricacao)}`, d.validade && `Validade ${dataBR(d.validade)}`, d.lote && `Lote ${d.lote}`].filter(Boolean).join(" | ");
  if (datas) linhas.push({ texto: datas, papel: "destaque" });
  const quem = [d.fabricante && `Fabricado por ${d.fabricante}`, d.documento, d.contato].filter(Boolean).join(" | ");
  if (quem) linhas.push({ texto: quem, papel: "quem" });
  return linhas;
}

export function textoRotulo(d: DadosRotulo): string {
  return linhasRotulo(d)
    .map((l) => l.texto)
    .join("\n");
}
