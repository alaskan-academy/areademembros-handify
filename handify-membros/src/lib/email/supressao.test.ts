import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A lista de nunca-enviar era lida com um `select` solto. O PostgREST corta em
 * 1.000 linhas e não devolve erro: da linha 1.001 em diante, quem pediu para
 * sair voltava a receber e ninguém ficava sabendo.
 *
 * O teste não toca na Resend — para nas consultas, que é onde o defeito mora.
 */

const paginas: { email: string }[][] = [];
let chamadas: { de: number; ate: number }[] = [];
let ordenou = false;
let erroNaLeitura: string | null = null;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        order: (coluna: string) => {
          ordenou = coluna === "email";
          return {
            range: async (de: number, ate: number) => {
              chamadas.push({ de, ate });
              if (erroNaLeitura) return { data: null, error: { message: erroNaLeitura } };
              return { data: paginas[Math.floor(de / 1000)] ?? [], error: null };
            },
          };
        },
      }),
    }),
  }),
}));

function paginaCheia(prefixo: string) {
  return Array.from({ length: 1000 }, (_, i) => ({ email: `${prefixo}${i}@handify.com.br` }));
}

beforeEach(() => {
  // O cache de 60s é de módulo: sem isto o segundo teste lê o Set do primeiro.
  vi.resetModules();
  paginas.length = 0;
  chamadas = [];
  ordenou = false;
  erroNaLeitura = null;
});

describe("lista de supressão", () => {
  it("enxerga endereço que está depois da linha 1.000", async () => {
    paginas.push(paginaCheia("a"), [{ email: "saiu@handify.com.br" }]);

    const { emailSuprimido } = await import("./index");

    expect(await emailSuprimido("saiu@handify.com.br")).toBe(true);
    expect(chamadas).toEqual([
      { de: 0, ate: 999 },
      { de: 1000, ate: 1999 },
    ]);
    // Sem ORDER BY as páginas repetem e pulam linhas — ficaria pior que o corte.
    expect(ordenou).toBe(true);
  });

  it("para na primeira página quando ela vem incompleta", async () => {
    paginas.push([{ email: "saiu@handify.com.br" }]);

    const { emailSuprimido } = await import("./index");

    expect(await emailSuprimido("SAIU@Handify.com.br ")).toBe(true);
    expect(chamadas).toHaveLength(1);
  });

  it("não suprime quem não está na lista", async () => {
    paginas.push(paginaCheia("a"), [{ email: "saiu@handify.com.br" }]);

    const { emailSuprimido } = await import("./index");

    expect(await emailSuprimido("aluna@handify.com.br")).toBe(false);
  });

  it("falha aberta: se a leitura cai, o e-mail continua saindo", async () => {
    erroNaLeitura = "timeout";

    const { emailSuprimido } = await import("./index");

    expect(await emailSuprimido("saiu@handify.com.br")).toBe(false);
  });

  it("filtrarSuprimidos corta o endereço que só aparece na segunda página", async () => {
    paginas.push(paginaCheia("a"), [{ email: "saiu@handify.com.br" }]);

    const { filtrarSuprimidos } = await import("./index");
    const passam = await filtrarSuprimidos([
      { to: "saiu@handify.com.br" },
      { to: "fica@handify.com.br" },
    ]);

    expect(passam.map((p) => p.to)).toEqual(["fica@handify.com.br"]);
  });
});
