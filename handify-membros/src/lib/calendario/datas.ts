/**
 * Calendário do artesanato — as datas que vendem no ano e quando começar a
 * produzir para chegar a tempo. Tudo puro: Páscoa, Dia das Mães, Dia dos Pais
 * e Black Friday são calculados; o resto é fixo. Os prazos vêm do que ela faz
 * (cold process cura 4 a 6 semanas; vela de soja descansa 1 a 2 semanas).
 */

export type Produz = "glicerinado" | "cold_process" | "velas" | "cosmetico";

export const PRODUZ: { key: Produz; nome: string; emoji: string; producao: number; cura: number; explica: string }[] = [
  { key: "glicerinado", nome: "Sabonete glicerinado", emoji: "🧼", producao: 2, cura: 1, explica: "1 dia para fazer, 1 dia para secar e embalar" },
  { key: "cold_process", nome: "Sabonete cold process", emoji: "🧪", producao: 2, cura: 35, explica: "cura de 4 a 6 semanas antes de vender" },
  { key: "velas", nome: "Velas", emoji: "🕯️", producao: 2, cura: 10, explica: "descansam de 4 a 10 dias para o aroma firmar (conta com 10)" },
  { key: "cosmetico", nome: "Cosméticos", emoji: "🫙", producao: 2, cura: 2, explica: "2 dias para fazer e conferir" },
];

/** Dias extras para quem manda pelos Correios (chegar antes da data). */
export const ENVIO_DIAS = 7;
/** Divulgar com antecedência: 3 semanas antes da data.*/
export const DIVULGAR_DIAS = 21;

export type DataVenda = {
  slug: string;
  nome: string;
  emoji: string;
  data: string; // YYYY-MM-DD
  peso: "alta" | "media";
  dica: string;
  /** Para quais produtos a data pesa mais. Vazio = todos. */
  produtos: Produz[];
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(ano, mes, dia);
}

/** N-ésimo domingo do mês (1 = primeiro). */
export function enesimoDomingo(ano: number, mes: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = 1 + ((7 - primeiro) % 7) + (n - 1) * 7;
  return iso(ano, mes, dia);
}

/** Última sexta de novembro. */
export function blackFriday(ano: number): string {
  const ultimo = new Date(Date.UTC(ano, 11, 0)); // 30/11
  const dia = ultimo.getUTCDate() - ((ultimo.getUTCDay() + 2) % 7);
  return iso(ano, 11, dia);
}

export function datasDoAno(ano: number): DataVenda[] {
  return [
    { slug: "mulher", nome: "Dia da Mulher", emoji: "💐", data: iso(ano, 3, 8), peso: "media", dica: "Kits pequenos para empresas presentearem funcionárias — venda em quantidade.", produtos: [] },
    { slug: "artesao", nome: "Dia do Artesão", emoji: "✂️", data: iso(ano, 3, 19), peso: "media", dica: "Dia de contar a sua história nas redes. Não vende direto, mas aproxima.", produtos: [] },
    { slug: "pascoa", nome: "Páscoa", emoji: "🐣", data: pascoa(ano), peso: "media", dica: "Sabonetes em formato de ovo e coelho, velas em tons pastel. Cesta com produtos pequenos.", produtos: ["glicerinado", "velas"] },
    { slug: "maes", nome: "Dia das Mães", emoji: "🌷", data: enesimoDomingo(ano, 5, 2), peso: "alta", dica: "A maior data do artesanato. Kit presente com vela + sabonete + cartão. Abra encomendas cedo.", produtos: [] },
    { slug: "namorados", nome: "Dia dos Namorados", emoji: "❤️", data: iso(ano, 6, 12), peso: "alta", dica: "Velas de massagem, kits para casal, embalagem em vermelho e rosé.", produtos: ["velas", "cosmetico", "glicerinado"] },
    { slug: "junina", nome: "Festas juninas", emoji: "🎪", data: iso(ano, 6, 24), peso: "media", dica: "Velas em pote de vidro e lembrancinhas de festa. Escolas e igrejas compram em lote.", produtos: ["velas"] },
    { slug: "amigos", nome: "Dia do Amigo", emoji: "🤝", data: iso(ano, 7, 20), peso: "media", dica: "Presente barato e afetivo: sabonete unitário embalado bonito.", produtos: ["glicerinado", "cold_process"] },
    { slug: "avos", nome: "Dia dos Avós", emoji: "👵", data: iso(ano, 7, 26), peso: "media", dica: "Escalda-pés, sabonete de calêndula, velas de lavanda — conforto vende.", produtos: ["cosmetico", "glicerinado", "velas"] },
    { slug: "pais", nome: "Dia dos Pais", emoji: "👔", data: enesimoDomingo(ano, 8, 2), peso: "alta", dica: "Aromas amadeirados e cítricos. Sabonete de barbear e vela de mesa.", produtos: [] },
    { slug: "cliente", nome: "Dia do Cliente", emoji: "🎁", data: iso(ano, 9, 15), peso: "media", dica: "Mande um mimo para quem já comprou de você. Reativa cliente antiga.", produtos: [] },
    { slug: "criancas", nome: "Dia das Crianças", emoji: "🧸", data: iso(ano, 10, 12), peso: "media", dica: "Sabonetes com brinquedo dentro, formatos divertidos. Lembrancinha de escola.", produtos: ["glicerinado"] },
    { slug: "professor", nome: "Dia do Professor", emoji: "📚", data: iso(ano, 10, 15), peso: "media", dica: "Pais e escolas compram lembrancinhas em quantidade. Venda o kit de 10 ou 20.", produtos: ["glicerinado", "velas"] },
    { slug: "blackfriday", nome: "Black Friday", emoji: "🏷️", data: blackFriday(ano), peso: "media", dica: "Não dê desconto no unitário: monte kits. É a largada do Natal.", produtos: [] },
    { slug: "natal", nome: "Natal", emoji: "🎄", data: iso(ano, 12, 25), peso: "alta", dica: "A segunda maior data. Velas de mesa, kits presente, lembrancinhas corporativas. Feche encomendas até início de dezembro.", produtos: [] },
    { slug: "reveillon", nome: "Réveillon", emoji: "🎆", data: iso(ano, 12, 31), peso: "media", dica: "Velas brancas e douradas, aromas cítricos. Vende junto com o Natal.", produtos: ["velas"] },
  ];
}

export const DIA = 86400000;

export function somarDias(data: string, dias: number): string {
  const [y, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + dias * DIA);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function diffDias(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA);
}

export function dataBR(isoData: string, comAno = false): string {
  const [y, m, d] = isoData.split("-");
  return comAno ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export type Prazos = {
  /** Último dia para começar a produzir e chegar a tempo. */
  produzirAte: string;
  /** Último dia para começar a divulgar. */
  divulgarAte: string;
  /** Dias de antecedência total (produção + cura + envio). */
  antecedencia: number;
  /** Quem manda: o produto de cura mais longa entre os que ela faz. */
  motivo: string;
};

/** Para uma data, quando começar — pelo produto de prazo mais longo que ela faz. */
export function prazosPara(data: string, produz: Produz[], envia: boolean): Prazos {
  const lista = PRODUZ.filter((p) => produz.includes(p.key));
  const maior = lista.sort((a, b) => b.producao + b.cura - (a.producao + a.cura))[0] ?? PRODUZ[0];
  const antecedencia = maior.producao + maior.cura + (envia ? ENVIO_DIAS : 0);
  return {
    produzirAte: somarDias(data, -antecedencia),
    divulgarAte: somarDias(data, -Math.max(DIVULGAR_DIAS, antecedencia)),
    antecedencia,
    motivo: `${maior.nome}: ${maior.explica}${envia ? `, mais ${ENVIO_DIAS} dias de envio` : ""}`,
  };
}

/** As próximas datas a partir de hoje (as deste ano que ainda não passaram + as do ano que vem). */
export function proximasDatas(hoje: string, produz: Produz[]): DataVenda[] {
  const ano = Number(hoje.slice(0, 4));
  return [...datasDoAno(ano), ...datasDoAno(ano + 1)]
    .filter((d) => d.data >= hoje)
    .filter((d) => d.produtos.length === 0 || produz.length === 0 || d.produtos.some((p) => produz.includes(p)))
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .slice(0, 14);
}
