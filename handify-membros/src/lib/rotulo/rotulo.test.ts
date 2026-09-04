import { describe, expect, it } from "vitest";
import { porFolha, fontes, linhasRotulo, textoRotulo, rotuloSchema, dadosVazios } from "./tipos";

describe("folha de rótulos", () => {
  it("quantos cabem no A4 com margem de 1 cm e 0,2 cm entre eles", () => {
    expect(porFolha(9, 5)).toBe(10);
    expect(porFolha(7, 4)).toBe(12);
    expect(porFolha(9, 7)).toBe(6);
    expect(porFolha(5, 5)).toBe(15);
    expect(porFolha(19, 27.7)).toBe(1);
  });
  it("letra cresce com a etiqueta, dentro do que ainda se lê", () => {
    expect(fontes(7, 4, "retangular").texto).toBeCloseTo(4.8, 1); // não desce de 4,8 pt
    expect(fontes(9, 5, "retangular").texto).toBeCloseTo(5.75, 2);
    expect(fontes(12, 8, "retangular").texto).toBe(7.2); // teto
    expect(fontes(7, 7, "redondo").produto).toBeCloseTo(7 * 1.75, 2);
  });
});

describe("conteúdo do rótulo", () => {
  it("monta as linhas na ordem da etiqueta e o texto para copiar", () => {
    const d = { ...dadosVazios(), marca: "Ateliê da Maria", produto: "Sabonete de lavanda", peso: "90 g", fabricacao: "2026-09-03", validade: "2027-09-03", lote: "0926-01", fabricante: "Maria" };
    const papeis = linhasRotulo(d).map((l) => l.papel);
    expect(papeis).toEqual(["marca", "produto", "tipo", "texto", "texto", "destaque", "quem"]);
    expect(textoRotulo(d)).toContain("Fabricação 03/09/2026 | Validade 03/09/2027 | Lote 0926-01");
    expect(textoRotulo(d)).toContain("Sabonete em barra — 90 g");
  });
  it("valida tamanho e cor", () => {
    expect(rotuloSchema.safeParse({ ...dadosVazios(), produto: "x", largura: 25 }).success).toBe(false);
    expect(rotuloSchema.safeParse({ ...dadosVazios(), produto: "x", cor: "roxo" }).success).toBe(false);
    expect(rotuloSchema.safeParse({ ...dadosVazios(), produto: "x", forma: "redondo", largura: 7, altura: 7, cor: "#7FA37A" }).success).toBe(true);
  });
});
