import { describe, it, expect } from "vitest";
import { escaparCuringas, padraoContem, filtroOrIlike } from "./like";

describe("escaparCuringas", () => {
  it("escapa o _ que existe em 232 e-mails de aluna", () => {
    // Sem isto, o padrão casa josiXrios123@, josi-rios123@, qualquer caractere.
    expect(escaparCuringas("josi_rios123@hotmail.com")).toBe("josi\\_rios123@hotmail.com");
  });

  it("escapa o % e a própria barra", () => {
    expect(escaparCuringas("100%")).toBe("100\\%");
    expect(escaparCuringas("a\\b")).toBe("a\\\\b");
  });

  it("não mexe em e-mail comum", () => {
    expect(escaparCuringas("maria@gmail.com")).toBe("maria@gmail.com");
  });
});

describe("padraoContem", () => {
  it("põe os curingas de fora e escapa os de dentro", () => {
    expect(padraoContem("saponária_1")).toBe("%saponária\\_1%");
  });
});

describe("filtroOrIlike", () => {
  it("dobra a barra, porque o PostgREST desfaz uma dentro das aspas", () => {
    // escaparCuringas põe \_ ; dentro do or() as aspas exigem \\_ para que
    // uma barra sobreviva até o SQL.
    expect(filtroOrIlike("email", "josi_rios")).toBe('email.ilike."%josi\\\\_rios%"');
  });

  it("neutraliza a aspa dupla, que fecharia o valor e abriria outro filtro", () => {
    expect(filtroOrIlike("title", 'a"b')).toBe('title.ilike."%a\\"b%"');
  });

  it("mantém vírgula e ponto dentro das aspas, sem virar outro filtro", () => {
    expect(filtroOrIlike("email", "a,b.c")).toBe('email.ilike."%a,b.c%"');
  });
});
