import { describe, expect, it } from "vitest";
import { produtosLiberados, produtoPadrao } from "./produtos";

describe("produto das calculadoras por curso", () => {
  it("Saboaria ou Cosméticos = sabonetes; Velas ou Aromas = velas; Completo = os dois", () => {
    expect(produtosLiberados(["saboaria-artesanal"], false)).toEqual(["sabonetes"]);
    expect(produtosLiberados(["cosmeticos-artesanais"], false)).toEqual(["sabonetes"]);
    expect(produtosLiberados(["aromas-e-casa"], false)).toEqual(["velas"]);
    expect(produtosLiberados(["saboaria-artesanal", "velas-artesanais"], false)).toEqual(["sabonetes", "velas"]);
    expect(produtosLiberados([], true)).toEqual(["sabonetes", "velas"]);
    expect(produtosLiberados([], false)).toEqual([]);
  });
  it("padrão: o único liberado; senão sabonetes", () => {
    expect(produtoPadrao(["velas-artesanais"], false)).toBe("velas");
    expect(produtoPadrao([], false)).toBe("sabonetes");
    expect(produtoPadrao([], true)).toBe("sabonetes");
  });
});
