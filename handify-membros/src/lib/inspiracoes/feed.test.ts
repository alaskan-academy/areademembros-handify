import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O feed de Inspirações abria em 1,25-1,5 s no celular, e o tempo era TODO de
 * servidor: três idas ao PostgREST (251 ms medidos) e um objeto de 83.638 bytes
 * entregue ao componente — que desce duas vezes no HTML, porque o InspiracaoFeed
 * é 'use client' e recebe os posts por prop.
 *
 * Estes testes guardam as três decisões que derrubaram esse número:
 *   1. uma consulta só, com as contagens feitas no banco;
 *   2. colunas explícitas, sem `select("*")`;
 *   3. o texto que só aparece depois do "Ver mais" fica no servidor, e a tela
 *      é avisada disso por `conteudo_truncado`.
 */

vi.mock("@/lib/auth/access", () => ({ hasActiveMembership: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({}) }) }));

/** Uma consulta registrada pelo mock, do jeito que a action a montou. */
interface ConsultaFeita {
  tabela: string;
  select?: string;
  filtros: [string, unknown][];
  limite?: number;
}

let consultas: ConsultaFeita[] = [];
let linhas: Record<string, unknown>[] = [];

function construtor(tabela: string) {
  const registro: ConsultaFeita = { tabela, filtros: [] };
  consultas.push(registro);

  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: (s: string) => {
      registro.select = s;
      return q;
    },
    eq: (coluna: string, valor: unknown) => {
      registro.filtros.push([coluna, valor]);
      return q;
    },
    or: () => q,
    contains: () => q,
    order: () => q,
    in: () => q,
    limit: (n: number) => {
      registro.limite = n;
      return q;
    },
    single: async () => ({ data: linhas[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: linhas[0] ?? null, error: null }),
    then: (ok: (r: unknown) => unknown) =>
      Promise.resolve({ data: linhas, error: null }).then(ok),
  });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "aluna-1" } } }) },
    from: (tabela: string) => construtor(tabela),
  }),
}));

import * as actions from "./actions";

const ALUNA = "aluna-1";

/** Bloco html do tamanho dos que existem no acervo (2.243 a 6.682 caracteres). */
function blocoLongo(paragrafos = 40): string {
  const p =
    '<p class="hf9-abre">A vela acende quase sem cheiro, e não foi a receita — ' +
    "foi a essência errada para o produto.</p>\n";
  return `<div class="hf9-post">\n${p.repeat(paragrafos)}</div>`;
}

function linhaDePost(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "post-1",
    author_id: "admin-1",
    type: "dica",
    title: "Lipossolúvel ou hidrossolúvel?",
    body: null,
    media: [],
    video_url: null,
    blocks: [{ type: "html", content: blocoLongo(), position: 0 }],
    recipe_data: null,
    tags: ["saboaria"],
    course_id: null,
    course_ids: [],
    featured_student_id: null,
    published: true,
    archived: false,
    pinned: false,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    author: null,
    featured_student: null,
    minha_curtida: [],
    meu_salvo: [],
    total_curtidas: [{ count: 11 }],
    total_comentarios: [{ count: 4 }],
    ...over,
  };
}

beforeEach(() => {
  consultas = [];
  linhas = [];
});

describe("uma ida só ao banco", () => {
  it("não abre consulta separada para contar curtida e comentário", async () => {
    linhas = [linhaDePost()];
    await actions.getInspiracoesFeed(ALUNA);

    // Eram três idas: a dos posts e mais duas que traziam TODAS as linhas de
    // curtida e de comentário para contar o tamanho do array no TypeScript.
    expect(consultas.map((c) => c.tabela)).toEqual(["inspiration_posts"]);
  });

  it("pede as contagens ao banco e lê o número que voltou", async () => {
    linhas = [linhaDePost()];
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(consultas[0].select).toContain("total_curtidas:inspiration_likes(count)");
    expect(consultas[0].select).toContain("total_comentarios:inspiration_comments(count)");
    expect(page.posts[0].like_count).toBe(11);
    expect(page.posts[0].comment_count).toBe(4);
  });

  it("conta só comentário aprovado, como a tela sempre mostrou", async () => {
    linhas = [linhaDePost()];
    await actions.getInspiracoesFeed(ALUNA);
    expect(consultas[0].filtros).toContainEqual(["total_comentarios.approved", true]);
  });

  it("traz curtida e salvo só da aluna da sessão", async () => {
    // Os embeds vinham sem filtro: 249 linhas de curtida e salvo nos 13 posts,
    // que o `...p` ainda copiava para dentro do objeto entregue à tela.
    linhas = [linhaDePost({ minha_curtida: [{ user_id: ALUNA }], meu_salvo: [] })];
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(consultas[0].filtros).toContainEqual(["minha_curtida.user_id", ALUNA]);
    expect(consultas[0].filtros).toContainEqual(["meu_salvo.user_id", ALUNA]);
    expect(page.posts[0].is_liked).toBe(true);
    expect(page.posts[0].is_bookmarked).toBe(false);
  });

  it("não devolve os apelidos dos embeds dentro do post", async () => {
    linhas = [linhaDePost()];
    const page = await actions.getInspiracoesFeed(ALUNA);
    const post = page.posts[0] as unknown as Record<string, unknown>;

    for (const apelido of ["minha_curtida", "meu_salvo", "total_curtidas", "total_comentarios"]) {
      expect(post[apelido], apelido).toBeUndefined();
    }
  });
});

describe("colunas explícitas", () => {
  it("não pede a linha inteira com select('*')", async () => {
    linhas = [linhaDePost()];
    await actions.getInspiracoesFeed(ALUNA);

    const select = consultas[0].select ?? "";
    expect(select.replace(/\s/g, "").startsWith("*,")).toBe(false);
  });

  it("pede tudo que InspiracaoFeedItem e InspiracaoCard leem do post", async () => {
    linhas = [linhaDePost()];
    await actions.getInspiracoesFeed(ALUNA);
    const select = consultas[0].select ?? "";

    // Varrido campo a campo nos dois componentes. Tirar qualquer um destes
    // apaga alguma coisa da tela dela.
    for (const campo of [
      "id", "type", "title", "body", "media", "video_url", "blocks", "recipe_data",
      "tags", "course_id", "course_ids", "pinned", "created_at",
    ]) {
      expect(select, campo).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    expect(select).toContain("author:profiles");
    expect(select).toContain("featured_student:profiles");
  });

  it("monta meia dúzia de posts por vez, não uma dúzia", async () => {
    // 12 posts chegavam como 83.638 bytes; 6 chegam como 22.411. O botão
    // "Carregar mais" traz o resto, agora a ~50 ms por toque.
    linhas = [linhaDePost()];
    await actions.getInspiracoesFeed(ALUNA);
    expect(consultas[0].limite).toBeLessThanOrEqual(7);
  });

  it("a sonda da próxima página não vira post na tela", async () => {
    const limite = 7; // PAGE_SIZE + 1
    linhas = Array.from({ length: limite }, (_, i) =>
      linhaDePost({ id: `post-${i}`, created_at: `2026-09-${20 - i}T10:00:00Z` })
    );
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(page.posts).toHaveLength(consultas[0].limite! - 1);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toEqual({
      created_at: page.posts[page.posts.length - 1].created_at,
      id: page.posts[page.posts.length - 1].id,
    });
  });
});

describe("prévia do conteúdo", () => {
  it("corta o bloco longo e avisa que sobrou texto", async () => {
    const inteiro = blocoLongo();
    linhas = [linhaDePost({ blocks: [{ type: "html", content: inteiro, position: 0 }] })];
    const page = await actions.getInspiracoesFeed(ALUNA);

    const recorte = page.posts[0].blocks[0].content;
    expect(recorte.length).toBeLessThan(inteiro.length);
    expect(inteiro.startsWith(recorte)).toBe(true);
    expect(page.posts[0].conteudo_truncado).toBe(true);
  });

  it("nunca parte uma tag no meio", async () => {
    // Recorte com tag aberta e não fechada vira atributo solto na tela — ou,
    // pior, texto cru aparecendo como se fosse código.
    for (const paragrafos of [12, 13, 17, 23, 40]) {
      linhas = [
        linhaDePost({ blocks: [{ type: "html", content: blocoLongo(paragrafos), position: 0 }] }),
      ];
      const page = await actions.getInspiracoesFeed(ALUNA);
      const recorte = page.posts[0].blocks[0].content;

      const ultimoAbre = recorte.lastIndexOf("<");
      const ultimoFecha = recorte.lastIndexOf(">");
      expect(ultimoFecha, `${paragrafos} parágrafos`).toBeGreaterThan(ultimoAbre - 1);
      expect(recorte.length, `${paragrafos} parágrafos`).toBeGreaterThan(0);
    }
  });

  it("bloco curto desce inteiro, e sem alarme falso", async () => {
    const curto = "<p>Guarde a essência longe do sol.</p>";
    linhas = [linhaDePost({ blocks: [{ type: "html", content: curto, position: 0 }] })];
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(page.posts[0].blocks[0].content).toBe(curto);
    expect(page.posts[0].conteudo_truncado).toBe(false);
  });

  it("a proporção do vídeo passa sempre", async () => {
    // O player fica ACIMA do corte e lê `video_meta`. Sem ele, o tutorial 9/16
    // abre em 16/9 e a aluna vê tarja preta dos dois lados.
    linhas = [
      linhaDePost({
        type: "video",
        blocks: [
          { type: "html", content: blocoLongo(), position: 0 },
          { type: "video_meta", content: "9/16", position: 1 },
        ],
      }),
    ];
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(page.posts[0].blocks.find((b) => b.type === "video_meta")?.content).toBe("9/16");
  });

  it("post sem bloco nenhum continua com lista vazia, não undefined", async () => {
    // InspiracaoFeedItem chama post.blocks.find/.filter/.some sem guarda.
    linhas = [linhaDePost({ blocks: null })];
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(page.posts[0].blocks).toEqual([]);
    expect(page.posts[0].conteudo_truncado).toBe(false);
  });

  it("a ficha da receita desce junto — é o que aparece antes do corte", async () => {
    const receita = { ingredientes: [{ item: "Base glicerinada", quantidade: "500 g" }] };
    linhas = [linhaDePost({ type: "receita", recipe_data: receita })];
    const page = await actions.getInspiracoesFeed(ALUNA);

    expect(page.posts[0].recipe_data).toEqual(receita);
  });
});

describe("getConteudoCompleto", () => {
  it("devolve blocos e receita de um post só", async () => {
    const blocks = [{ type: "html", content: blocoLongo(), position: 0 }];
    linhas = [{ blocks, recipe_data: { tempo: "40 min" } }];

    const conteudo = await actions.getConteudoCompleto("post-1");

    expect(conteudo?.blocks).toEqual(blocks);
    expect(conteudo?.recipe_data).toEqual({ tempo: "40 min" });
    expect(consultas[0].select).toBe("blocks, recipe_data");
  });

  it("não abre por id o que o feed não abriria", async () => {
    linhas = [{ blocks: [], recipe_data: null }];
    await actions.getConteudoCompleto("post-1");

    // Mesmo recorte da lista. A matrícula em si é a RLS de inspiration_posts,
    // e por isso a consulta tem de sair pelo client de sessão — service client
    // aqui abriria o acervo para quem não é aluna.
    expect(consultas[0].tabela).toBe("inspiration_posts");
    expect(consultas[0].filtros).toContainEqual(["published", true]);
    expect(consultas[0].filtros).toContainEqual(["archived", false]);
    expect(consultas[0].filtros).toContainEqual(["id", "post-1"]);
  });

  it("post que sumiu devolve null em vez de estourar", async () => {
    linhas = [];
    expect(await actions.getConteudoCompleto("post-fantasma")).toBeNull();
  });
});
