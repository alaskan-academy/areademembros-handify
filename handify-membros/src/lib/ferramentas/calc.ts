/**
 * A matemática das ferramentas de receita, sem React.
 *
 * Extraída das calculadoras de Lucro, Essências e Pavio para o fluxo "Minha
 * receita" usar a mesma conta que as telas antigas — e para dar para testar
 * com números conferidos na mão (calc.test.ts). Se um valor mudar de lugar,
 * muda aqui, uma vez.
 */

import type { WickRecommendation } from "@/lib/pavio/types";

// ─── Custo e preço (era: Calculadora de Lucro) ───────────────────────────────

/** Um insumo: comprei X por R$ Y e uso Z no lote. Mesma unidade em X e Z. */
export type Insumo = {
  nome: string;
  qtdComprada: number;
  precoCompra: number;
  qtdUsadaNoLote: number;
};

/** Embalagem: por unidade (rótulo, caixinha) ou por lote (caixa de envio). */
export type Embalagem = Insumo & { escopo: "unidade" | "lote" };

export type OutrosCustos = {
  /** Horas de trabalho no lote × valor da hora. */
  horasTrabalho: number;
  valorHora: number;
  /** Luz, gás, água do lote. */
  utilidades: number;
  /** Frete dos insumos até você. */
  frete: number;
  /** Divulgação do lote. */
  marketing: number;
  /** % de perda de matéria-prima (respingo, sobra na panela). */
  perdaPct: number;
  /** % que o canal fica (marketplace). */
  canalPct: number;
  /** % de imposto sobre o preço. */
  impostoPct: number;
};

export type CustoBase = {
  unidades: number;
  materiaPrimaPorUnidade: number;
  perdaPorUnidade: number;
  embalagemPorUnidade: number;
  maoDeObraPorUnidade: number;
  fixosPorUnidade: number;
  marketingPorUnidade: number;
  /** Tudo somado: o que uma unidade custa antes de qualquer margem. */
  custoPorUnidade: number;
  canal: number;
  imposto: number;
};

export function custoInsumo(i: Insumo): number {
  if (!(i.qtdComprada > 0)) return 0;
  return (i.qtdUsadaNoLote / i.qtdComprada) * i.precoCompra;
}

/** Custo da embalagem POR UNIDADE. */
export function custoEmbalagemPorUnidade(e: Embalagem, unidades: number): number {
  if (!(e.qtdComprada > 0)) return 0;
  const porItem = e.precoCompra / e.qtdComprada;
  const custo = porItem * e.qtdUsadaNoLote;
  return e.escopo === "unidade" ? custo : unidades > 0 ? custo / unidades : 0;
}

export function calcularCustoBase(input: {
  unidades: number;
  insumos: Insumo[];
  embalagens: Embalagem[];
  outros: OutrosCustos;
}): CustoBase {
  const unidades = input.unidades > 0 ? input.unidades : 1;
  const o = input.outros;

  const materiaPrimaLote = input.insumos.reduce((s, i) => s + custoInsumo(i), 0);
  const materiaPrimaPorUnidade = materiaPrimaLote / unidades;
  const perdaPorUnidade = materiaPrimaPorUnidade * (o.perdaPct / 100);
  const embalagemPorUnidade = input.embalagens.reduce(
    (s, e) => s + custoEmbalagemPorUnidade(e, unidades),
    0
  );
  const maoDeObraPorUnidade = (o.horasTrabalho * o.valorHora) / unidades;
  const fixosPorUnidade = (o.utilidades + o.frete) / unidades;
  const marketingPorUnidade = o.marketing / unidades;

  const custoPorUnidade =
    materiaPrimaPorUnidade +
    perdaPorUnidade +
    embalagemPorUnidade +
    maoDeObraPorUnidade +
    fixosPorUnidade +
    marketingPorUnidade;

  return {
    unidades,
    materiaPrimaPorUnidade,
    perdaPorUnidade,
    embalagemPorUnidade,
    maoDeObraPorUnidade,
    fixosPorUnidade,
    marketingPorUnidade,
    custoPorUnidade,
    canal: o.canalPct / 100,
    imposto: o.impostoPct / 100,
  };
}

/**
 * Preço para uma margem. A margem é % DO PREÇO (não do custo), e canal e
 * imposto também saem do preço — por isso divide por (1 − soma), não multiplica.
 * Se a soma passar de 100% não existe preço que feche; devolve 10× o custo,
 * como a calculadora antiga, para a tela não quebrar.
 */
export function precoParaMargem(custo: CustoBase, margemPct: number): number {
  const deducoes = margemPct / 100 + custo.canal + custo.imposto;
  if (deducoes >= 1) return custo.custoPorUnidade * 10;
  return custo.custoPorUnidade / (1 - deducoes);
}

/** O que sobra por unidade depois de custo, canal e imposto. */
export function lucroPorUnidade(custo: CustoBase, preco: number): number {
  return preco - custo.custoPorUnidade - preco * custo.canal - preco * custo.imposto;
}

export function avisoDeMargem(margemPct: number): { tom: "ruim" | "atencao" | "bom"; texto: string } {
  if (margemPct < 20) return { tom: "ruim", texto: "Margem muito baixa — qualquer imprevisto vira prejuízo." };
  if (margemPct < 30) return { tom: "atencao", texto: "Margem no limite. Acima de 30% é onde o artesanato respira." };
  if (margemPct <= 60) return { tom: "bom", texto: "Margem saudável — é o intervalo recomendado para artesanato." };
  if (margemPct <= 75) return { tom: "atencao", texto: "Margem alta. Funciona no premium, se o produto justificar." };
  return { tom: "ruim", texto: "Margem muito alta — pode afastar clientes." };
}

// ─── Essências (era: Calculadora de Essências) ───────────────────────────────

export type TipoAroma = "essencia" | "oleo";
export type Intensidade = "suave" | "moderado" | "intenso";

/** % sobre o peso do lote, por produto e tipo de aroma. */
export const TAXAS_AROMA: Record<"sabonetes" | "velas", Record<TipoAroma, Record<Intensidade, number>>> = {
  sabonetes: {
    essencia: { suave: 1, moderado: 2, intenso: 3 },
    oleo: { suave: 0.5, moderado: 1, intenso: 1.5 },
  },
  velas: {
    essencia: { suave: 5, moderado: 8, intenso: 10 },
    oleo: { suave: 3, moderado: 4, intenso: 5 },
  },
};

/** Essência sintética ≈ água; óleo essencial é mais leve. */
export const DENSIDADE: Record<TipoAroma, number> = { essencia: 1.0, oleo: 0.9 };
export const GOTAS_POR_ML = 20;

export function calcularAroma(input: {
  unidades: number;
  pesoPorUnidade: number;
  tipo: TipoAroma;
  percentual: number;
}): { pesoLote: number; gramas: number; ml: number; gotas: number } {
  const pesoLote = input.unidades * input.pesoPorUnidade;
  const gramas = pesoLote > 0 && input.percentual > 0 ? pesoLote * (input.percentual / 100) : 0;
  const ml = gramas > 0 ? gramas / DENSIDADE[input.tipo] : 0;
  return { pesoLote, gramas, ml, gotas: Math.round(ml * GOTAS_POR_ML) };
}

// ─── Escala de lote (era: "Calculadora de Receita", que nunca existiu) ───────

/** Mesma receita para outro tamanho de lote: cada insumo escala na proporção. */
export function escalarLote<T extends { qtdUsadaNoLote: number }>(
  insumos: T[],
  unidadesAtuais: number,
  unidadesNovas: number
): T[] {
  if (!(unidadesAtuais > 0) || !(unidadesNovas > 0)) return insumos;
  const fator = unidadesNovas / unidadesAtuais;
  return insumos.map((i) => ({ ...i, qtdUsadaNoLote: i.qtdUsadaNoLote * fator }));
}

// ─── Pavio (era: Calculadora de Pavio) ───────────────────────────────────────

export type RespostasPavio = {
  candleType: "container" | "mold" | null;
  waxType: string | null;
  moldShape: string | null;
  diameterValue: number | null;
  fragranceMid: number | null;
  hasDye: boolean | null;
};

/**
 * Primeira recomendação (a lista vem ordenada por prioridade) cujas faixas
 * contêm as respostas. `has_dye` nulo e `mold_shape` nulo são curinga.
 */
export function encontrarPavio(recs: WickRecommendation[], a: RespostasPavio): WickRecommendation | null {
  if (!a.candleType || !a.waxType || !a.diameterValue || a.fragranceMid === null) return null;
  const d = a.diameterValue;
  const f = a.fragranceMid;
  return (
    recs.find(
      (r) =>
        r.candle_type === a.candleType &&
        r.wax_type === a.waxType &&
        r.diameter_min <= d &&
        d <= r.diameter_max &&
        r.fragrance_min <= f &&
        f <= r.fragrance_max &&
        (r.has_dye === null || r.has_dye === (a.hasDye ?? false)) &&
        (a.candleType === "container" || r.mold_shape === null || r.mold_shape === a.moldShape)
    ) ?? null
  );
}

// ─── Formatação ──────────────────────────────────────────────────────────────

export function reais(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function numero(n: number, casas = 1): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(casas).replace(".", ",");
}
