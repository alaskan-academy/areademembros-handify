import { describe, expect, it } from "vitest";
import { calcularValidade, somarMeses, somarDias, prazoTexto, type EntradaValidade } from "./validade";

const base: EntradaValidade = {
  tipo: "glicerinado",
  fabricacao: "2026-09-03",
  conservante: "nenhum",
  prazoConservanteMeses: null,
  antioxidante: false,
  oleosFrageis: false,
  frescos: false,
  aroma: "essencia",
  embalagem: "fechada",
  insumos: [],
};

describe("datas", () => {
  it("soma meses sem pular o fim do mês", () => {
    expect(somarMeses("2026-08-31", 6)).toBe("2027-02-28");
    expect(somarMeses("2026-09-03", 12)).toBe("2027-09-03");
    expect(somarMeses("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("soma dias", () => {
    expect(somarDias("2026-09-03", 7)).toBe("2026-09-10");
  });
  it("escreve o prazo do jeito que ela lê", () => {
    expect(prazoTexto(7)).toBe("7 dias");
    expect(prazoTexto(30)).toBe("1 mês");
    expect(prazoTexto(365)).toBe("12 meses");
  });
});

describe("validade por tipo", () => {
  it("glicerinado embalado com essência = 12 meses", () => {
    const r = calcularValidade(base);
    expect(r.vence).toBe("2027-09-03");
    expect(r.prazoTexto).toBe("12 meses");
    expect(r.rotulo).toEqual({ fabricacao: "03/09/2026", validade: "03/09/2027", lote: "0926-01" });
  });
  it("glicerinado sem embalar cai para 6; óleo essencial encurta mais", () => {
    expect(calcularValidade({ ...base, embalagem: "aberta" }).prazoTexto).toBe("6 meses");
    expect(calcularValidade({ ...base, aroma: "oleo_essencial" }).prazoTexto).toBe("9 meses");
  });
  it("líquido sem conservante = 7 dias e alerta de perigo", () => {
    const r = calcularValidade({ ...base, tipo: "liquido" });
    expect(r.vence).toBe("2026-09-10");
    expect(r.alertas[0].nivel).toBe("perigo");
    expect(r.sugestoes[0].titulo).toMatch(/Conservante/);
  });
  it("com água e conservante = prazo do fabricante, no máximo 6 meses", () => {
    expect(calcularValidade({ ...base, tipo: "com_agua", conservante: "sintetico" }).vence).toBe("2026-12-03");
    const r = calcularValidade({ ...base, tipo: "com_agua", conservante: "natural", prazoConservanteMeses: 12 });
    expect(r.prazoTexto).toBe("6 meses");
    expect(r.alertas.some((a) => a.texto.includes("máximo prudente"))).toBe(true);
  });
  it("'não sei' se tem conservante conta como sem", () => {
    const r = calcularValidade({ ...base, tipo: "com_agua", conservante: "nao_sei" });
    expect(r.dias).toBe(7);
    expect(r.alertas[0].texto).toMatch(/Não sabe/);
  });
  it("cold process: óleos frágeis 6 meses, antioxidante leva a 9; sem frágeis 12 → 18", () => {
    expect(calcularValidade({ ...base, tipo: "cold_process", oleosFrageis: true }).prazoTexto).toBe("6 meses");
    expect(calcularValidade({ ...base, tipo: "cold_process", oleosFrageis: true, antioxidante: true }).prazoTexto).toBe("9 meses");
    expect(calcularValidade({ ...base, tipo: "cold_process", antioxidante: true }).prazoTexto).toBe("18 meses");
  });
  it("antioxidante em produto com água sem conservante não vira conservante", () => {
    const r = calcularValidade({ ...base, tipo: "com_agua", antioxidante: true });
    expect(r.dias).toBe(7);
    expect(r.alertas.some((a) => a.texto.includes("não substitui conservante"))).toBe(true);
  });
  it("vela: com aroma 12 meses, sem aroma 24", () => {
    expect(calcularValidade({ ...base, tipo: "vela" }).prazoTexto).toBe("12 meses");
    expect(calcularValidade({ ...base, tipo: "vela", aroma: "nenhum" }).prazoTexto).toBe("24 meses");
  });
});

describe("ingredientes", () => {
  it("fresco sem conservante = 7 dias mesmo no glicerinado", () => {
    const r = calcularValidade({ ...base, frescos: true });
    expect(r.dias).toBe(7);
    expect(r.limitante).toMatch(/fresco/);
  });
  it("fresco com conservante não passa de 1 mês", () => {
    const r = calcularValidade({ ...base, tipo: "com_agua", conservante: "sintetico", prazoConservanteMeses: 6, frescos: true });
    expect(r.vence).toBe("2026-10-03");
  });
  it("o insumo que vence primeiro manda", () => {
    const r = calcularValidade({ ...base, insumos: [{ nome: "Base glicerinada", validade: "2027-01-15" }, { nome: "Essência", validade: "2028-01-01" }] });
    expect(r.vence).toBe("2027-01-15");
    expect(r.limitante).toBe("Base glicerinada, que vence em 15/01/2027");
  });
  it("insumo já vencido vira alerta de perigo e não entra na conta", () => {
    const r = calcularValidade({ ...base, insumos: [{ nome: "Óleo de coco", validade: "2026-08-01" }] });
    expect(r.vence).toBe("2027-09-03");
    expect(r.alertas.some((a) => a.nivel === "perigo" && a.texto.includes("já venceu"))).toBe(true);
  });
});
