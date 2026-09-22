import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * As ações `admin*` de Inspirações são endpoints de verdade: o InspiracaoForm é
 * 'use client' e importa duas delas, então o Next publica os IDs num chunk
 * estático. Sem guarda de role, qualquer aluna logada apagava ou reescrevia o
 * acervo. Este teste existe para que nenhum export novo volte a nascer sem
 * guarda — se alguém acrescentar uma ação `admin*` e esquecer o assertAdmin, a
 * varredura do último caso quebra.
 */

// Não deixar o módulo real subir: ele importa "server-only", que estoura fora do
// runtime do Next.
vi.mock("@/lib/auth/access", () => ({ hasActiveMembership: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let perfilRole: string | null = "admin";
let usuario: { id: string } | null = { id: "admin-1" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: perfilRole ? { role: perfilRole } : null }),
        }),
      }),
    }),
  }),
}));

/** O que o service client gravou, para conferir a autoria. */
let gravado: Record<string, unknown> | null = null;
const abriuServiceClient = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    abriuServiceClient();
    const resultado = { data: { id: "post-1" }, error: null };
    const cadeia: Record<string, unknown> = {};
    const devolve = () => cadeia;
    Object.assign(cadeia, {
      select: devolve,
      eq: devolve,
      order: devolve,
      or: devolve,
      update: devolve,
      delete: devolve,
      insert: (record: Record<string, unknown>) => {
        gravado = record;
        return cadeia;
      },
      single: async () => resultado,
      then: (ok: (r: typeof resultado) => unknown) => Promise.resolve(resultado).then(ok),
    });
    return { from: () => cadeia };
  },
}));

import * as actions from "./actions";

const PAYLOAD = { type: "foto" as const, title: "Post" };

/** Uma chamada plausível de cada ação de admin exportada. */
const CHAMADAS: Record<string, () => Promise<unknown>> = {
  adminListPosts: () => actions.adminListPosts(),
  adminGetPost: () => actions.adminGetPost("post-1"),
  adminUpsertPost: () => actions.adminUpsertPost(PAYLOAD),
  adminDeletePost: () => actions.adminDeletePost("post-1"),
  adminArchivePost: () => actions.adminArchivePost("post-1", true),
  adminPublishPost: () => actions.adminPublishPost("post-1", true),
  adminGetPendingComments: () => actions.adminGetPendingComments(),
  adminGetPendingCommentsCount: () => actions.adminGetPendingCommentsCount(),
  adminApproveComment: () => actions.adminApproveComment("c-1", true),
  adminDeleteComment: () => actions.adminDeleteComment("c-1"),
};

beforeEach(() => {
  perfilRole = "admin";
  usuario = { id: "admin-1" };
  gravado = null;
  abriuServiceClient.mockClear();
});

describe("guarda de admin nas ações de Inspirações", () => {
  it("recusa aluna logada sem papel de admin — e nem chega a abrir o service client", async () => {
    perfilRole = "student";
    usuario = { id: "aluna-9" };

    for (const [nome, chamar] of Object.entries(CHAMADAS)) {
      await expect(chamar(), nome).rejects.toThrow("Não autorizado");
    }
    // O service client ignora RLS: se ele abrir antes da guarda, a checagem não
    // serve para nada.
    expect(abriuServiceClient).not.toHaveBeenCalled();
  });

  it("recusa quem não tem sessão", async () => {
    usuario = null;
    perfilRole = null;

    for (const [nome, chamar] of Object.entries(CHAMADAS)) {
      await expect(chamar(), nome).rejects.toThrow("Não autorizado");
    }
  });

  it("recusa perfil sem linha em profiles", async () => {
    usuario = { id: "fantasma" };
    perfilRole = null;
    await expect(actions.adminDeletePost("post-1")).rejects.toThrow("Não autorizado");
  });

  it("deixa o admin passar", async () => {
    await expect(actions.adminUpsertPost(PAYLOAD)).resolves.toEqual({ id: "post-1" });
    expect(abriuServiceClient).toHaveBeenCalled();
  });

  it("toda ação admin exportada passa pela guarda", async () => {
    // Varredura: export novo sem entrada aqui = guarda esquecida, teste quebra.
    const exportados = Object.keys(actions).filter((k) => k.startsWith("admin"));
    expect(exportados.sort()).toEqual(Object.keys(CHAMADAS).sort());
  });
});

describe("autoria do post", () => {
  it("grava o autor da sessão, não o que veio do cliente", async () => {
    // Antes a action recebia `adminId` como primeiro argumento e escrevia direto
    // em author_id — dava para assinar post em nome de outra pessoa.
    usuario = { id: "admin-verdadeiro" };
    await actions.adminUpsertPost({ ...PAYLOAD, author_id: "outra-pessoa" } as never);
    expect(gravado).toMatchObject({ author_id: "admin-verdadeiro" });
  });
});
