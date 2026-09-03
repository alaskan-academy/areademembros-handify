import { describe, expect, it } from "vitest";
import {
  calcularAroma,
  calcularCustoBase,
  custoEmbalagemPorUnidade,
  custoInsumo,
  encontrarPavio,
  escalarLote,
  lucroPorUnidade,
  precoParaMargem,
  TAXAS_AROMA,
  codigosNoFornecedor,
  normalizarNomePavio,
  type Embalagem,
  type Insumo,
  type OutrosCustos,
} from "./calc";
import type { WickRecommendation } from "@/lib/pavio/types";

// Receita de referência, conferida na mão: 20 sabonetes de 90 g.
const base: Insumo = { nome: "Base glicerinada", qtdComprada: 1000, precoCompra: 30, qtdUsadaNoLote: 1800 };
const essencia: Insumo = { nome: "Essência", qtdComprada: 100, precoCompra: 25, qtdUsadaNoLote: 36 };
const rotulo: Embalagem = { nome: "Rótulo", qtdComprada: 50, precoCompra: 10, qtdUsadaNoLote: 1, escopo: "unidade" };
const caixaEnvio: Embalagem = { nome: "Caixa de envio", qtdComprada: 10, precoCompra: 20, qtdUsadaNoLote: 1, escopo: "lote" };
const outros: OutrosCustos = {
  horasTrabalho: 2,
  valorHora: 15,
  utilidades: 10,
  frete: 20,
  marketing: 0,
  perdaPct: 5,
  canalPct: 0,
  impostoPct: 0,
};

describe("custo dos insumos", () => {
  it("proporção do que foi usado sobre o que foi comprado", () => {
    // 1800 g de 1000 g a R$ 30 → 1,8 × 30
    expect(custoInsumo(base)).toBeCloseTo(54, 6);
    // 36 mL de 100 mL a R$ 25
    expect(custoInsumo(essencia)).toBeCloseTo(9, 6);
  });

  it("insumo sem quantidade comprada não divide por zero", () => {
    expect(custoInsumo({ ...base, qtdComprada: 0 })).toBe(0);
  });

  it("embalagem por unidade e por lote", () => {
    // R$ 10 / 50 rótulos = R$ 0,20 cada
    expect(custoEmbalagemPorUnidade(rotulo, 20)).toBeCloseTo(0.2, 6);
    // R$ 20 / 10 caixas = R$ 2 a caixa, dividida por 20 sabonetes
    expect(custoEmbalagemPorUnidade(caixaEnvio, 20)).toBeCloseTo(0.1, 6);
  });
});

describe("custo base por unidade", () => {
  const custo = calcularCustoBase({ unidades: 20, insumos: [base, essencia], embalagens: [rotulo, caixaEnvio], outros });

  it("cada parcela", () => {
    expect(custo.materiaPrimaPorUnidade).toBeCloseTo(63 / 20, 6); // 3,15
    expect(custo.perdaPorUnidade).toBeCloseTo(3.15 * 0.05, 6); // 0,1575
    expect(custo.embalagemPorUnidade).toBeCloseTo(0.3, 6);
    expect(custo.maoDeObraPorUnidade).toBeCloseTo(30 / 20, 6); // 1,50
    expect(custo.fixosPorUnidade).toBeCloseTo(30 / 20, 6); // 1,50
    expect(custo.marketingPorUnidade).toBe(0);
  });

  it("soma: 3,15 + 0,1575 + 0,30 + 1,50 + 1,50 = 6,6075", () => {
    expect(custo.custoPorUnidade).toBeCloseTo(6.6075, 6);
  });

  it("lote de 0 unidades vira 1 para não dividir por zero", () => {
    const c = calcularCustoBase({ unidades: 0, insumos: [base], embalagens: [], outros });
    expect(c.unidades).toBe(1);
    expect(c.materiaPrimaPorUnidade).toBeCloseTo(54, 6);
  });

  it("valor negativo conta como zero, nunca como desconto (achado no teste: -1 h tirava R$ 1,50 do custo)", () => {
    const c = calcularCustoBase({
      unidades: 20,
      insumos: [base, essencia, { ...base, nome: "Bug", qtdUsadaNoLote: -500 }],
      embalagens: [rotulo, caixaEnvio],
      outros: { ...outros, horasTrabalho: -1, frete: -20 },
    });
    // igual à receita de referência sem mão de obra (−1 h → 0) e sem frete (−20 → 0):
    // 3,15 + 0,1575 + 0,30 + 0 + (10 + 0)/20 = 4,1075
    expect(c.maoDeObraPorUnidade).toBe(0);
    expect(c.fixosPorUnidade).toBeCloseTo(0.5, 6);
    expect(c.custoPorUnidade).toBeCloseTo(4.1075, 6);
  });
});

describe("preço e lucro", () => {
  const custo = calcularCustoBase({ unidades: 20, insumos: [base, essencia], embalagens: [rotulo, caixaEnvio], outros });

  it("margem de 40% é 40% do PREÇO: preço = custo / 0,6", () => {
    const preco = precoParaMargem(custo, 40);
    expect(preco).toBeCloseTo(6.6075 / 0.6, 6); // 11,0125
    expect(lucroPorUnidade(custo, preco)).toBeCloseTo(preco * 0.4, 6);
  });

  it("canal e imposto também saem do preço", () => {
    const comCanal = calcularCustoBase({
      unidades: 20,
      insumos: [base, essencia],
      embalagens: [rotulo, caixaEnvio],
      outros: { ...outros, canalPct: 15, impostoPct: 6 },
    });
    const preco = precoParaMargem(comCanal, 40);
    // 6,6075 / (1 − 0,40 − 0,15 − 0,06) = 6,6075 / 0,39
    expect(preco).toBeCloseTo(6.6075 / 0.39, 6);
    // o que sobra continua sendo 40% do preço
    expect(lucroPorUnidade(comCanal, preco)).toBeCloseTo(preco * 0.4, 6);
  });

  it("deduções de 100% ou mais não têm preço possível — devolve 10× o custo", () => {
    const impossivel = calcularCustoBase({
      unidades: 20,
      insumos: [base],
      embalagens: [],
      outros: { ...outros, canalPct: 50, impostoPct: 20 },
    });
    expect(precoParaMargem(impossivel, 40)).toBeCloseTo(impossivel.custoPorUnidade * 10, 6);
  });
});

describe("aroma", () => {
  it("sabonete: 20 × 90 g, essência moderada (2%) → 36 g, 36 mL, 720 gotas", () => {
    const r = calcularAroma({ unidades: 20, pesoPorUnidade: 90, tipo: "essencia", percentual: TAXAS_AROMA.sabonetes.essencia.moderado });
    expect(r.pesoLote).toBe(1800);
    expect(r.gramas).toBeCloseTo(36, 6);
    expect(r.ml).toBeCloseTo(36, 6);
    expect(r.gotas).toBe(720);
  });

  it("óleo essencial é mais leve: 9 g viram 10 mL (densidade 0,9)", () => {
    const r = calcularAroma({ unidades: 20, pesoPorUnidade: 90, tipo: "oleo", percentual: TAXAS_AROMA.sabonetes.oleo.suave });
    expect(r.gramas).toBeCloseTo(9, 6);
    expect(r.ml).toBeCloseTo(10, 6);
    expect(r.gotas).toBe(200);
  });

  it("vela: 10 × 200 g, essência intensa (10%) → 200 g = 200 mL = 4000 gotas", () => {
    const r = calcularAroma({ unidades: 10, pesoPorUnidade: 200, tipo: "essencia", percentual: TAXAS_AROMA.velas.essencia.intenso });
    expect(r.gramas).toBeCloseTo(200, 6);
    expect(r.gotas).toBe(4000);
  });

  it("sem peso ou sem percentual, zero — não NaN", () => {
    expect(calcularAroma({ unidades: 0, pesoPorUnidade: 90, tipo: "essencia", percentual: 2 }).gramas).toBe(0);
    expect(calcularAroma({ unidades: 20, pesoPorUnidade: 90, tipo: "essencia", percentual: 0 }).gotas).toBe(0);
  });
});

describe("escala de lote", () => {
  it("de 20 para 50 unidades multiplica cada insumo por 2,5", () => {
    const [b, e] = escalarLote([base, essencia], 20, 50);
    expect(b.qtdUsadaNoLote).toBeCloseTo(4500, 6);
    expect(e.qtdUsadaNoLote).toBeCloseTo(90, 6);
  });

  it("lote inválido devolve a receita como está", () => {
    expect(escalarLote([base], 0, 50)[0].qtdUsadaNoLote).toBe(1800);
  });
});

describe("pavio", () => {
  const rec = (over: Partial<WickRecommendation>): WickRecommendation => ({
    id: "r",
    candle_type: "container",
    wax_type: "soy",
    diameter_min: 6,
    diameter_max: 8,
    fragrance_min: 6,
    fragrance_max: 10,
    has_dye: null,
    mold_shape: null,
    wick_primary: "ECO 10",
    wick_alternatives: ["ECO 12"],
    notes: null,
    course_lesson_id: null,
    priority: 1,
    active: true,
    ...over,
  });

  it("acha pela faixa de diâmetro e fragrância; corante nulo é curinga", () => {
    const r = encontrarPavio([rec({})], {
      candleType: "container", waxType: "soy", moldShape: null, diameterValue: 7, fragranceMid: 8, hasDye: true,
    });
    expect(r?.wick_primary).toBe("ECO 10");
  });

  it("fora da faixa, nada", () => {
    const r = encontrarPavio([rec({})], {
      candleType: "container", waxType: "soy", moldShape: null, diameterValue: 9, fragranceMid: 8, hasDye: null,
    });
    expect(r).toBeNull();
  });

  it("molde respeita o formato; recipiente ignora", () => {
    const cil = rec({ id: "c", candle_type: "mold", mold_shape: "cylindrical", wick_primary: "CDN 12" });
    const naoBate = encontrarPavio([cil], {
      candleType: "mold", waxType: "soy", moldShape: "conical", diameterValue: 7, fragranceMid: 8, hasDye: false,
    });
    expect(naoBate).toBeNull();
    const bate = encontrarPavio([cil], {
      candleType: "mold", waxType: "soy", moldShape: "cylindrical", diameterValue: 7, fragranceMid: 8, hasDye: false,
    });
    expect(bate?.wick_primary).toBe("CDN 12");
  });

  it("a primeira da lista (prioridade) vence", () => {
    const r = encontrarPavio([rec({ id: "a", wick_primary: "A" }), rec({ id: "b", wick_primary: "B" })], {
      candleType: "container", waxType: "soy", moldShape: null, diameterValue: 7, fragranceMid: 8, hasDye: null,
    });
    expect(r?.wick_primary).toBe("A");
  });
});

describe("código do pavio na loja", () => {
  it("LX 12 com soja: pede A (queima suave); B fica como alternativa", () => {
    const c = codigosNoFornecedor("LX 12", "soy");
    expect(c.indicados).toEqual(["A2025"]);
    expect(c.outros).toEqual(["B2020", "B2025"]);
    expect(c.mm).toBe("3");
  });

  it("LX 12 com parafina: pede B (queima forte)", () => {
    const c = codigosNoFornecedor("LX 12", "paraffin");
    expect(c.indicados).toEqual(["B2020", "B2025"]);
    expect(c.outros).toEqual(["A2025"]);
  });

  it("série sem código da cera (ECO 4 só tem B) não deixa a aluna sem resposta", () => {
    const c = codigosNoFornecedor("ECO 4", "soy");
    expect(c.indicados).toEqual(["B2020"]);
    expect(c.outros).toEqual([]);
  });

  it("cera desconhecida: todos os equivalentes, sem preferência", () => {
    const c = codigosNoFornecedor("CD 10", "blend");
    expect(c.indicados).toEqual(["A2020", "B2020"]);
    expect(c.outros).toEqual([]);
  });

  it("normaliza '2× LX 12 (2 pavios)' e 'nº'", () => {
    expect(normalizarNomePavio("2× LX 12 (2 pavios)")).toBe("LX 12");
    expect(normalizarNomePavio("Pavio quadrado nº 4")).toBe("Pavio quadrado #4");
    expect(codigosNoFornecedor("2× LX 12 (2 pavios)", "soy").indicados).toEqual(["A2025"]);
  });

  it("pavio fora da tabela: vazio, não erro", () => {
    expect(codigosNoFornecedor("Pavio de madeira", "soy")).toEqual({ indicados: [], outros: [], mm: null });
  });
});
