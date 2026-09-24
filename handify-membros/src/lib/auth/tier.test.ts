import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * O tier é PORTÃO, não enfeite. Três páginas fazem literalmente
 *
 *   if ((await getTier()) === 'visitante') return <SoParaAlunas />
 *
 * (`comunidade/forum/page.tsx:20`, `inspiracoes/page.tsx`, `inspiracoes/salvos/page.tsx:19`)
 *
 * Então um tier que não seja uma das quatro palavras — `null`, `undefined`,
 * qualquer coisa — faz a comparação dar false, o muro não aparece e a página
 * abre para quem não devia. Falha ABERTA, e silenciosa.
 *
 * O risco é concreto porque `createClient()` não passa o genérico `Database`,
 * então `supabase.rpc('current_tier')` devolve `any`: o TypeScript não segura
 * nada aqui, e `.rpc()` nunca lança — devolve `{ data, error }` em todo modo de
 * falha. Estes testes existem para que a próxima pessoa que mexer no getTier
 * descubra isso pelo teste vermelho, e não por uma aluna entrando onde não devia.
 */

const TIERS_VALIDOS = ["visitante", "aluna", "completo", "admin"];

// `access.ts` começa com `import "server-only"`, que só existe dentro do bundler
// do Next. Fora dele o pacote não é resolvido e o arquivo nem carrega.
vi.mock("server-only", () => ({}));

/** O que a RPC devolveu desta vez. */
let respostaRpc: { data: unknown; error: { message: string } | null };
/** O que o caminho antigo, de quatro consultas, encontraria. */
let caminhoAntigo: { role?: string; membership?: boolean; enrollment?: boolean; semUsuario?: boolean };
/** Quantas idas ao banco cada chamada custou. */
let idas: string[];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        idas.push("auth.getUser");
        return caminhoAntigo.semUsuario
          ? { data: { user: null } }
          : { data: { user: { id: "aluna-1" } } };
      },
    },
    rpc: async (nome: string) => {
      idas.push(`rpc.${nome}`);
      return respostaRpc;
    },
    from: (tabela: string) => {
      const encadeia: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "or", "limit"]) {
        encadeia[m] = () => encadeia;
      }
      encadeia.maybeSingle = async () => {
        idas.push(`from.${tabela}`);
        if (tabela === "profiles") return { data: { role: caminhoAntigo.role ?? "student" } };
        if (tabela === "memberships") return { data: caminhoAntigo.membership ? { id: "m1" } : null };
        if (tabela === "enrollments") return { data: caminhoAntigo.enrollment ? { id: "e1" } : null };
        return { data: null };
      };
      return encadeia;
    },
  }),
  createServiceClient: () => ({ from: () => ({}) }),
}));

import { getTier } from "./access";

beforeEach(() => {
  idas = [];
  respostaRpc = { data: "aluna", error: null };
  caminhoAntigo = { role: "student", membership: false, enrollment: true };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getTier: uma ida em vez de quatro", () => {
  it("responde pela RPC, sem tocar em profiles, memberships nem enrollments", async () => {
    respostaRpc = { data: "completo", error: null };
    expect(await getTier()).toBe("completo");
    expect(idas).toEqual(["rpc.current_tier"]);
  });

  it("devolve as quatro palavras que a RPC pode responder", async () => {
    for (const t of TIERS_VALIDOS) {
      respostaRpc = { data: t, error: null };
      expect(await getTier()).toBe(t);
    }
  });
});

describe("o portão não pode falhar aberto", () => {
  // O caminho antigo aqui devolve 'visitante': sem matrícula, sem plano, não admin.
  beforeEach(() => {
    caminhoAntigo = { role: "student", membership: false, enrollment: false };
  });

  const lixos: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["string vazia", ""],
    ["palavra que não existe", "premium"],
    ["número", 1],
    ["objeto", { tier: "aluna" }],
    ["array", ["aluna"]],
  ];

  for (const [nome, valor] of lixos) {
    it(`RPC devolvendo ${nome} não vira tier — cai no caminho antigo`, async () => {
      respostaRpc = { data: valor, error: null };
      const tier = await getTier();
      expect(TIERS_VALIDOS).toContain(tier);
      // É ESTE o ponto: as três páginas comparam com 'visitante'. Se o valor
      // não for exatamente isso, o muro some.
      expect(tier).toBe("visitante");
      expect(idas).toContain("from.enrollments");
    });
  }

  it("qualquer resposta possível ainda é uma das quatro palavras", async () => {
    for (const [, valor] of lixos) {
      respostaRpc = { data: valor, error: null };
      expect(TIERS_VALIDOS).toContain(await getTier());
    }
    respostaRpc = { data: null, error: { message: "qualquer falha" } };
    expect(TIERS_VALIDOS).toContain(await getTier());
  });
});

describe("erro da RPC cai no caminho antigo, não em 'visitante' mudo", () => {
  it("aluna com matrícula continua aluna quando a RPC falha", async () => {
    respostaRpc = { data: null, error: { message: "permission denied for function current_tier" } };
    caminhoAntigo = { role: "student", membership: false, enrollment: true };
    expect(await getTier()).toBe("aluna");
  });

  it("quem tem o Completo continua completo quando a RPC falha", async () => {
    respostaRpc = { data: null, error: { message: "timeout" } };
    caminhoAntigo = { role: "student", membership: true, enrollment: false };
    expect(await getTier()).toBe("completo");
  });

  it("admin continua admin quando a RPC falha", async () => {
    respostaRpc = { data: null, error: { message: "503" } };
    caminhoAntigo = { role: "admin" };
    expect(await getTier()).toBe("admin");
  });

  it("sem sessão nenhuma devolve visitante, como sempre devolveu", async () => {
    respostaRpc = { data: null, error: { message: "permission denied for function current_tier" } };
    caminhoAntigo = { semUsuario: true };
    expect(await getTier()).toBe("visitante");
  });

  it("deixa rastro no log — erro sem rastro é o que some de vista", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    respostaRpc = { data: null, error: { message: "boom" } };
    await getTier();
    expect(log).toHaveBeenCalled();
    expect(String(log.mock.calls[0].join(" "))).toContain("boom");
  });
});
