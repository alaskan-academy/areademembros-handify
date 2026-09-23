import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes do aviso do fórum e da árvore de comentários.
 *
 * Nada aqui toca banco nem Web Push: o service client é um dublê que responde e
 * anota o que foi pedido, igual ao de dispatch.test.ts.
 */

const h = vi.hoisted(() => ({
  pushes: [] as { userId: string; link?: string; title: string }[],
  pushQuebra: false,
  banco: null as ReturnType<typeof criarBancoTipo> | null,
}));

declare function criarBancoTipo(): Banco;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/push", () => ({
  sendPushToUser: async (userId: string, payload: { title: string; link?: string }) => {
    if (h.pushQuebra) throw new Error("aparelho sumiu");
    h.pushes.push({ userId, title: payload.title, link: payload.link });
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => (h.banco as unknown as Banco).cliente(),
}));

import {
  avisarAdminsDoForum,
  linkDoPostNoForum,
  montarArvoreDeComentarios,
  pushDeRespostaNoForum,
  quemRecebeAvisoDeComentario,
  resumir,
} from "./forum";

// ── Dublê do supabase-js ──────────────────────────────────────────

type Consulta = {
  tabela: string;
  op: "select" | "insert";
  filtros: string[];
  linhas?: Record<string, unknown>[];
};

type Banco = ReturnType<typeof criarBanco>;

function criarBanco(config: {
  admins?: string[];
  erroAoListar?: string;
  erroAoInserir?: string;
}) {
  const chamadas: Consulta[] = [];

  function responder(q: Consulta) {
    if (q.tabela === "profiles") {
      if (config.erroAoListar) return { data: null, error: { message: config.erroAoListar } };
      return { data: (config.admins ?? []).map((id) => ({ id })), error: null };
    }
    if (q.tabela === "notifications") {
      return { data: null, error: config.erroAoInserir ? { message: config.erroAoInserir } : null };
    }
    throw new Error(`tabela inesperada no teste: ${q.tabela}`);
  }

  function from(tabela: string) {
    const q: Consulta = { tabela, op: "select", filtros: [] };
    const finalizar = () => {
      chamadas.push(q);
      return Promise.resolve(responder(q));
    };
    const construtor = {
      select: () => construtor,
      insert: (linhas: Record<string, unknown>[]) => {
        q.op = "insert";
        q.linhas = linhas;
        return finalizar();
      },
      eq: (col: string, val: unknown) => {
        q.filtros.push(`${col}=${String(val)}`);
        return construtor;
      },
      then: (ok: (r: unknown) => unknown, falhou?: (e: unknown) => unknown) =>
        finalizar().then(ok, falhou),
    };
    return construtor;
  }

  return {
    cliente: () => ({ from }),
    chamadas,
    sinos: () => chamadas.filter((c) => c.tabela === "notifications" && c.op === "insert"),
  };
}

beforeEach(() => {
  h.pushes = [];
  h.pushQuebra = false;
  h.banco = criarBanco({ admins: ["admin-1"] });
});

// ── O link combinado entre as frentes ─────────────────────────────

describe("linkDoPostNoForum", () => {
  it("leva ao post exato, e ao comentário quando há um", () => {
    expect(linkDoPostNoForum("velas", "p1")).toBe("/comunidade/forum/velas?post=p1");
    expect(linkDoPostNoForum("velas", "p1", "c9")).toBe(
      "/comunidade/forum/velas?post=p1&comentario=c9"
    );
  });
});

describe("resumir", () => {
  it("não corta o que já cabe", () => {
    expect(resumir("oi", 10)).toBe("oi");
  });

  it("corta sem partir palavra ao meio", () => {
    const texto = "derreti a parafina e ficou cheia de bolha no meio da vela";
    const curto = resumir(texto, 20);
    expect(curto.endsWith("…")).toBe(true);
    expect(curto.length).toBeLessThanOrEqual(21);
    expect(curto).not.toContain("  ");
  });

  it("junta quebra de linha — o sino é uma linha só", () => {
    expect(resumir("uma\n\nduas")).toBe("uma duas");
  });
});

// ── Quem recebe aviso ─────────────────────────────────────────────

describe("quemRecebeAvisoDeComentario", () => {
  it("comentário simples avisa a dona do post", () => {
    expect(
      quemRecebeAvisoDeComentario({ autorDoComentario: "b", autorDoPost: "a" })
    ).toEqual(["a"]);
  });

  it("resposta avisa a dona do comentário e a dona do post", () => {
    expect(
      quemRecebeAvisoDeComentario({
        autorDoComentario: "c",
        autorDoPost: "a",
        autorDoComentarioPai: "b",
      })
    ).toEqual(["b", "a"]);
  });

  it("não avisa duas vezes quem é dona do post E do comentário respondido", () => {
    expect(
      quemRecebeAvisoDeComentario({
        autorDoComentario: "c",
        autorDoPost: "a",
        autorDoComentarioPai: "a",
      })
    ).toEqual(["a"]);
  });

  it("ninguém recebe aviso de si mesma", () => {
    expect(
      quemRecebeAvisoDeComentario({
        autorDoComentario: "a",
        autorDoPost: "a",
        autorDoComentarioPai: "a",
      })
    ).toEqual([]);
  });

  it("post sem dona conhecida não quebra", () => {
    expect(
      quemRecebeAvisoDeComentario({ autorDoComentario: "b", autorDoPost: null })
    ).toEqual([]);
  });
});

// ── Árvore de comentários ─────────────────────────────────────────

type Fake = { id: string; parent_id: string | null };
const c = (id: string, parent_id: string | null = null): Fake => ({ id, parent_id });

describe("montarArvoreDeComentarios", () => {
  it("põe a resposta sob o comentário respondido", () => {
    const arvore = montarArvoreDeComentarios([c("1"), c("2", "1"), c("3")]);
    expect(arvore.map((n) => n.id)).toEqual(["1", "3"]);
    expect(arvore[0].respostas.map((r) => r.id)).toEqual(["2"]);
  });

  it("resposta de resposta fica no mesmo nível — um nível só, como o PRD manda", () => {
    const arvore = montarArvoreDeComentarios([c("1"), c("2", "1"), c("3", "2")]);
    expect(arvore).toHaveLength(1);
    expect(arvore[0].respostas.map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("comentário órfão continua aparecendo — pai apagado não some com a resposta", () => {
    const arvore = montarArvoreDeComentarios([c("2", "apagado"), c("3")]);
    expect(arvore.map((n) => n.id)).toEqual(["2", "3"]);
    expect(arvore[0].respostas).toEqual([]);
  });

  it("não perde ninguém quando os dados vêm em ciclo", () => {
    const arvore = montarArvoreDeComentarios([c("a", "b"), c("b", "a")]);
    const ids = arvore.flatMap((n) => [n.id, ...n.respostas.map((r) => r.id)]);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("mantém a ordem de chegada das raízes e das respostas", () => {
    const arvore = montarArvoreDeComentarios([
      c("1"), c("2"), c("1a", "1"), c("2a", "2"), c("1b", "1"),
    ]);
    expect(arvore.map((n) => n.id)).toEqual(["1", "2"]);
    expect(arvore[0].respostas.map((r) => r.id)).toEqual(["1a", "1b"]);
    expect(arvore[1].respostas.map((r) => r.id)).toEqual(["2a"]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(montarArvoreDeComentarios([])).toEqual([]);
  });

  it("não perde campo nenhum do comentário", () => {
    const arvore = montarArvoreDeComentarios([
      { id: "1", parent_id: null, body: "oi", like_count: 3 },
    ]);
    expect(arvore[0].body).toBe("oi");
    expect(arvore[0].like_count).toBe(3);
  });
});

// ── Aviso para a equipe ───────────────────────────────────────────

const atividade = {
  autorId: "aluna-1",
  autorNome: "Maria",
  tipo: "comentario" as const,
  tituloDoPost: "Vela com bolha",
  trecho: "derreti a 80 graus e mesmo assim deu bolha",
  link: "/comunidade/forum/velas?post=p1&comentario=c1",
};

describe("avisarAdminsDoForum", () => {
  it("põe o sino e manda o push para a equipe", async () => {
    h.banco = criarBanco({ admins: ["admin-1", "admin-2"] });
    const quantos = await avisarAdminsDoForum(atividade);

    expect(quantos).toBe(2);
    const [sino] = h.banco!.sinos();
    expect(sino.linhas).toHaveLength(2);
    expect(sino.linhas![0].type).toBe("forum_activity");
    expect(sino.linhas![0].link).toBe(atividade.link);
    expect(String(sino.linhas![0].title)).toContain("Vela com bolha");
    expect(String(sino.linhas![0].body)).toContain("Maria");
    expect(h.pushes.map((p) => p.userId)).toEqual(["admin-1", "admin-2"]);
  });

  it("não avisa quem escreveu, mesmo sendo da equipe", async () => {
    h.banco = criarBanco({ admins: ["admin-1", "aluna-1"] });
    const quantos = await avisarAdminsDoForum(atividade);
    expect(quantos).toBe(1);
    expect(h.pushes.map((p) => p.userId)).toEqual(["admin-1"]);
  });

  it("não repete quem o gatilho do banco já avisou", async () => {
    h.banco = criarBanco({ admins: ["admin-1", "admin-2"] });
    const quantos = await avisarAdminsDoForum({
      ...atividade,
      jaAvisados: ["admin-2", null, undefined],
    });
    expect(quantos).toBe(1);
    expect(h.banco!.sinos()[0].linhas).toHaveLength(1);
    expect(h.pushes.map((p) => p.userId)).toEqual(["admin-1"]);
  });

  it("post novo aponta para a moderação, que é onde se aprova", async () => {
    await avisarAdminsDoForum({ ...atividade, tipo: "post", link: "/admin/comunidade/forum" });
    const sino = h.banco!.sinos()[0];
    expect(String(sino.linhas![0].title)).toContain("Post novo");
    expect(sino.linhas![0].link).toBe("/admin/comunidade/forum");
  });

  it("sem equipe cadastrada, não escreve nada", async () => {
    h.banco = criarBanco({ admins: [] });
    expect(await avisarAdminsDoForum(atividade)).toBe(0);
    expect(h.banco!.sinos()).toHaveLength(0);
    expect(h.pushes).toHaveLength(0);
  });

  it("procura só quem é admin e não está banida", async () => {
    await avisarAdminsDoForum(atividade);
    const consulta = h.banco!.chamadas.find((q) => q.tabela === "profiles");
    expect(consulta?.filtros).toEqual(["role=admin", "banned=false"]);
  });

  it("push quebrado não derruba o comentário da aluna", async () => {
    h.pushQuebra = true;
    await expect(avisarAdminsDoForum(atividade)).resolves.toBe(1);
  });

  it("banco fora do ar não derruba o comentário da aluna", async () => {
    h.banco = criarBanco({ erroAoListar: "sem conexão" });
    await expect(avisarAdminsDoForum(atividade)).resolves.toBe(0);
    expect(h.pushes).toHaveLength(0);
  });

  it("sino recusado ainda tenta o push — é o que chega no celular", async () => {
    h.banco = criarBanco({ admins: ["admin-1"], erroAoInserir: "enum desconhecido" });
    await avisarAdminsDoForum(atividade);
    expect(h.pushes.map((p) => p.userId)).toEqual(["admin-1"]);
  });
});

describe("pushDeRespostaNoForum", () => {
  it("manda para cada pessoa avisada, com o link do comentário", async () => {
    await pushDeRespostaNoForum(["a", "b"], {
      tituloDoPost: "Vela com bolha",
      autorNome: "Maria",
      trecho: "tenta 70 graus",
      link: atividade.link,
    });
    expect(h.pushes.map((p) => p.userId)).toEqual(["a", "b"]);
    expect(h.pushes[0].link).toBe(atividade.link);
  });

  it("sem ninguém para avisar, não faz requisição nenhuma", async () => {
    await pushDeRespostaNoForum([], {
      tituloDoPost: "x", autorNome: "y", trecho: "z", link: "/l",
    });
    expect(h.pushes).toHaveLength(0);
  });

  it("aparelho vencido não vira erro na cara da aluna", async () => {
    h.pushQuebra = true;
    await expect(
      pushDeRespostaNoForum(["a"], { tituloDoPost: "x", autorNome: "y", trecho: "z", link: "/l" })
    ).resolves.toBeUndefined();
  });
});
