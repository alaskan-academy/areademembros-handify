import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Duas regras que custam caro se voltarem atrás:
 *
 * 1. Quem tem role=admin comenta e já aparece; aluna continua indo para a fila.
 *    Quem decide isso é a SESSÃO lida no servidor, nunca o `userId` que o painel
 *    ('use client') manda no primeiro argumento — senão bastava passar o id de
 *    uma admin para publicar no acervo sem moderação.
 *
 * 2. A notificação "Alguém respondeu ao seu comentário" tem que levar o link
 *    profundo do post. Como o comentário da admin não passa mais pela aprovação,
 *    o aviso passou a sair no próprio insert: sem isso a resposta dela chegaria
 *    muda para a aluna.
 */

vi.mock("@/lib/auth/access", () => ({ hasActiveMembership: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let usuario: { id: string } | null = { id: "aluna-1" };
let perfilRole: string | null = "student";
/** O que o client de SESSÃO gravou em inspiration_comments. */
let comentarioGravado: Record<string, unknown> | null = null;
let erroDoInsert: { message: string } | null = null;
/** Se o insert pediu a linha de volta (RETURNING). Ver o teste da RLS abaixo. */
let pediuRetorno = false;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    from: (tabela: string) => {
      if (tabela === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: perfilRole ? { role: perfilRole } : null }),
            }),
          }),
        };
      }
      return {
        insert: (record: Record<string, unknown>) => {
          comentarioGravado = record;
          pediuRetorno = false;
          const resultado = {
            data: erroDoInsert ? null : { id: "comentario-novo" },
            error: erroDoInsert,
          };
          return {
            // Caminho da aluna: o insert é aguardado direto, sem RETURNING.
            then: (ok: (r: { error: { message: string } | null }) => unknown) =>
              Promise.resolve({ error: erroDoInsert }).then(ok),
            // Caminho da admin: pede o id de volta para notificar a resposta.
            select: () => {
              pediuRetorno = true;
              return { single: async () => resultado };
            },
          };
        },
      };
    },
  }),
}));

/** Respostas de `.single()` do service client, na ordem em que o código pede. */
const filaDeSelects: Array<Record<string, unknown> | null> = [];
/** Tudo que o service client inseriu, com a tabela de destino. */
const gravadosPeloServico: Array<{ tabela: string; record: Record<string, unknown> }> = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (tabela: string) => {
      const cadeia: Record<string, unknown> = {};
      const devolve = () => cadeia;
      Object.assign(cadeia, {
        select: devolve,
        eq: devolve,
        in: devolve,
        order: devolve,
        limit: devolve,
        update: devolve,
        delete: devolve,
        insert: (record: Record<string, unknown>) => {
          gravadosPeloServico.push({ tabela, record });
          return cadeia;
        },
        single: async () => ({ data: filaDeSelects.shift() ?? null, error: null }),
        then: (ok: (r: { data: null; error: null }) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(ok),
      });
      return cadeia;
    },
  }),
}));

import { submitComment, adminApproveComment } from "./actions";

const notificacoes = () => gravadosPeloServico.filter((g) => g.tabela === "notifications");

beforeEach(() => {
  usuario = { id: "aluna-1" };
  perfilRole = "student";
  comentarioGravado = null;
  erroDoInsert = null;
  pediuRetorno = false;
  filaDeSelects.length = 0;
  gravadosPeloServico.length = 0;
});

describe("quem nasce aprovado", () => {
  it("comentário de aluna vai para a fila", async () => {
    const r = await submitComment("aluna-1", "post-1", "Ficou lindo!");
    expect(r).toEqual({ approved: false });
    expect(comentarioGravado).toMatchObject({
      post_id: "post-1",
      user_id: "aluna-1",
      body: "Ficou lindo!",
      approved: false,
    });
  });

  it("comentário da admin já nasce publicado", async () => {
    usuario = { id: "jessica" };
    perfilRole = "admin";

    const r = await submitComment("jessica", "post-1", "Uso essência hidrossolúvel.");
    expect(r).toEqual({ approved: true });
    expect(comentarioGravado).toMatchObject({ user_id: "jessica", approved: true });
  });

  it("não confia no userId que veio do cliente", async () => {
    // Sessão de aluna comum mandando o id de uma admin no primeiro argumento.
    usuario = { id: "aluna-1" };
    perfilRole = "student";

    await submitComment("jessica", "post-1", "Passa direto?");
    expect(comentarioGravado).toMatchObject({ user_id: "aluna-1", approved: false });
  });

  it("sem sessão não grava nada", async () => {
    usuario = null;
    perfilRole = null;

    const r = await submitComment("jessica", "post-1", "Sem cookie.");
    expect(r.error).toBeTruthy();
    expect(comentarioGravado).toBeNull();
  });

  it("não pede a linha de volta no comentário da aluna", async () => {
    // A policy de leitura de inspiration_comments só mostra `approved = true`.
    // Um `.select()` no insert da aluna faria o RETURNING passar por essa policy
    // e a gravação inteira voltaria como erro — ninguém mais comentaria.
    await submitComment("aluna-1", "post-1", "Ficou lindo!");
    expect(pediuRetorno).toBe(false);

    usuario = { id: "jessica" };
    perfilRole = "admin";
    await submitComment("jessica", "post-1", "Obrigada!");
    expect(pediuRetorno).toBe(true);
  });

  it("continua recusando comentário curto demais, antes de olhar a sessão", async () => {
    const r = await submitComment("aluna-1", "post-1", "a");
    expect(r.error).toBe("Comentário muito curto.");
    expect(comentarioGravado).toBeNull();
  });
});

describe("aviso de resposta", () => {
  it("resposta da admin avisa a aluna com o link do post", async () => {
    usuario = { id: "jessica" };
    perfilRole = "admin";
    filaDeSelects.push({ user_id: "aluna-7" }); // autora do comentário respondido

    await submitComment("jessica", "post-1", "Uso a hidrossolúvel, sim!", "comentario-pai");

    expect(notificacoes()).toHaveLength(1);
    expect(notificacoes()[0].record).toMatchObject({
      user_id: "aluna-7",
      type: "comment_reply",
      link: "/inspiracoes?post=post-1&comentario=comentario-novo",
    });
  });

  it("admin respondendo a si mesma não notifica ninguém", async () => {
    usuario = { id: "jessica" };
    perfilRole = "admin";
    filaDeSelects.push({ user_id: "jessica" });

    await submitComment("jessica", "post-1", "Complementando o que falei.", "comentario-pai");
    expect(notificacoes()).toHaveLength(0);
  });

  it("comentário de aluna não notifica no insert — quem avisa é a aprovação", async () => {
    filaDeSelects.push({ user_id: "aluna-7" });
    await submitComment("aluna-1", "post-1", "Também quero saber!", "comentario-pai");
    expect(notificacoes()).toHaveLength(0);
  });

  it("na aprovação, o aviso leva o post e o comentário — não o feed inteiro", async () => {
    usuario = { id: "jessica" };
    perfilRole = "admin";
    // 1º select: o comentário aprovado. 2º select: a autora do comentário pai.
    filaDeSelects.push({
      parent_id: "comentario-pai",
      user_id: "aluna-1",
      body: "Também quero saber!",
      post_id: "post-42",
    });
    filaDeSelects.push({ user_id: "aluna-7" });

    await adminApproveComment("comentario-3", true);

    expect(notificacoes()[0].record).toMatchObject({
      user_id: "aluna-7",
      link: "/inspiracoes?post=post-42&comentario=comentario-3",
    });
  });
});
