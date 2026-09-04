import { describe, expect, it } from "vitest";
import { calcularMeta } from "./meta";

describe("meta de renda", () => {
  const base = { metaMes: 2000, precoMedio: 25, custoMedio: 10, horasSemana: 20, minutosPorUnidade: 15, diasPorSemana: 5 };
  it("meta R$ 2.000 com R$ 15 de lucro por peça = 134 peças no mês", () => {
    const r = calcularMeta(base);
    expect(r.lucroUnidade).toBe(15);
    expect(r.margemPct).toBe(60);
    expect(r.unidadesMes).toBe(134);
    expect(r.unidadesSemana).toBe(31);
    expect(r.unidadesDia).toBe(7);
    expect(r.faturamentoMes).toBe(3350);
    expect(r.horasNecessariasSemana).toBe(7.8);
    expect(r.cabe).toBe(true);
  });
  it("não cabe no tempo quando as horas não fecham", () => {
    const r = calcularMeta({ ...base, horasSemana: 5 });
    expect(r.cabe).toBe(false);
    expect(r.alertas.some((a) => a.includes("Não cabe"))).toBe(true);
  });
  it("preço abaixo do custo para tudo", () => {
    const r = calcularMeta({ ...base, precoMedio: 8 });
    expect(r.unidadesMes).toBe(0);
    expect(r.alertas[0]).toMatch(/não cobre o custo/);
  });
  it("cenários: +10% e +20% no preço pedem menos peças", () => {
    const r = calcularMeta(base);
    expect(r.cenarios.map((c) => c.unidadesMes)).toEqual([134, 115, 100]);
  });
  it("margem apertada avisa", () => {
    const r = calcularMeta({ ...base, precoMedio: 12 });
    expect(r.margemPct).toBe(17);
    expect(r.alertas.some((a) => a.includes("apertada"))).toBe(true);
  });
});
