import { describe, expect, it } from "vitest";
import { pascoa, enesimoDomingo, blackFriday, prazosPara, proximasDatas, datasDoAno } from "./datas";

describe("datas móveis", () => {
  it("Páscoa", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
    expect(pascoa(2028)).toBe("2028-04-16");
  });
  it("Dia das Mães e dos Pais = segundo domingo", () => {
    expect(enesimoDomingo(2026, 5, 2)).toBe("2026-05-10");
    expect(enesimoDomingo(2027, 5, 2)).toBe("2027-05-09");
    expect(enesimoDomingo(2026, 8, 2)).toBe("2026-08-09");
  });
  it("Black Friday = última sexta de novembro", () => {
    expect(blackFriday(2026)).toBe("2026-11-27");
    expect(blackFriday(2027)).toBe("2027-11-26");
  });
  it("o ano tem 15 datas em ordem", () => {
    const d = datasDoAno(2026);
    expect(d).toHaveLength(15);
    expect(d.find((x) => x.slug === "natal")?.data).toBe("2026-12-25");
  });
});

describe("prazos", () => {
  it("cold process manda: 2 + 35 dias, mais 7 se envia", () => {
    const p = prazosPara("2026-12-25", ["glicerinado", "cold_process"], false);
    expect(p.antecedencia).toBe(37);
    expect(p.produzirAte).toBe("2026-11-18");
    expect(p.divulgarAte).toBe("2026-11-18"); // divulgação = o maior entre 21 e a antecedência
    expect(prazosPara("2026-12-25", ["cold_process"], true).produzirAte).toBe("2026-11-11");
  });
  it("glicerinado: 3 dias; divulgar 3 semanas antes", () => {
    const p = prazosPara("2026-05-10", ["glicerinado"], false);
    expect(p.produzirAte).toBe("2026-05-07");
    expect(p.divulgarAte).toBe("2026-04-19");
  });
  it("próximas datas: só as que ainda não passaram e que pesam para o que ela faz", () => {
    const prox = proximasDatas("2026-09-04", ["velas"]);
    expect(prox[0].slug).toBe("cliente");
    expect(prox.some((d) => d.slug === "criancas")).toBe(false); // só glicerinado
    expect(prox.some((d) => d.slug === "reveillon")).toBe(true);
    expect(prox.some((d) => d.data.startsWith("2027"))).toBe(true);
  });
});
