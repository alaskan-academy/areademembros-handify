import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Publicar um aviso do feed anuncia para ~4.5 mil alunas. Dois defeitos moravam
 * aqui:
 *
 *  1. o TypeScript inseria em `notifications` junto com o gatilho do banco —
 *     cada publicação entregava 2 sinos por aluna;
 *  2. despublicar e republicar satisfazia de novo a única guarda que existia
 *     (a transição false->true), então a admin renotificava a base inteira a
 *     cada clique.
 *
 * O teste para nas consultas: não toca na Resend e não escreve em lugar nenhum.
 */

type Chamada = { tabela: string; metodo: string; args: unknown[] };

let chamadas: Chamada[] = [];
/** Quantas linhas o claim atômico (`.is("notified_at", null)`) devolve. */
let claimDevolve: { id: string }[] = [];

function consulta(tabela: string) {
  const cadeia: string[] = [];
  const alvo: Record<string, unknown> = {
    then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      let resultado: { data: unknown; error: unknown } = { data: null, error: null };
      if (tabela === "profiles" && cadeia.includes("single")) {
        resultado = { data: { role: "admin" }, error: null };
      } else if (tabela === "news_posts" && cadeia.includes("is")) {
        resultado = { data: claimDevolve, error: null };
      }
      return Promise.resolve(resultado).then(onOk, onErr);
    },
  };
  for (const metodo of ["select", "update", "insert", "upsert", "delete", "eq", "is", "not", "order", "range", "single"]) {
    alvo[metodo] = (...args: unknown[]) => {
      cadeia.push(metodo);
      chamadas.push({ tabela, metodo, args });
      return alvo;
    };
  }
  return alvo;
}

const clienteFalso = {
  auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
  from: (tabela: string) => consulta(tabela),
};

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFalso }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
// fetch-all começa com `import "server-only"`, que não resolve fora do bundler
// do Next — o mock evita carregar o módulo de verdade.
vi.mock("@/lib/supabase/fetch-all", () => ({ fetchAll: vi.fn(async () => []) }));

const enviarLote = vi.fn(async () => ({ enviados: [] as string[], erro: null }));
vi.mock("@/lib/email", () => ({ sendNewsPostEmailBatch: enviarLote }));

beforeEach(() => {
  chamadas = [];
  claimDevolve = [{ id: "post-1" }];
  enviarLote.mockClear();
});

function inserçõesEm(tabela: string) {
  return chamadas.filter((c) => c.tabela === tabela && c.metodo === "insert");
}

describe("toggleNewsPublished", () => {
  it("publica pela primeira vez com claim atômico em notified_at", async () => {
    const { toggleNewsPublished } = await import("./actions");

    expect(await toggleNewsPublished("post-1", true)).toEqual({});

    const claim = chamadas.find((c) => c.tabela === "news_posts" && c.metodo === "is");
    expect(claim?.args).toEqual(["notified_at", null]);
  });

  it("não insere sino nenhum — o sino é do gatilho do banco", async () => {
    const { toggleNewsPublished } = await import("./actions");

    await toggleNewsPublished("post-1", true);

    // Se esta asserção cair, voltamos a entregar 2 notificações por aluna:
    // uma do gatilho `on_news_post_published` e outra daqui.
    expect(inserçõesEm("notifications")).toHaveLength(0);
  });

  it("republicar não anuncia de novo: o claim volta vazio e cai no update simples", async () => {
    claimDevolve = [];
    const { toggleNewsPublished } = await import("./actions");

    expect(await toggleNewsPublished("post-1", true)).toEqual({});

    const updates = chamadas.filter((c) => c.tabela === "news_posts" && c.metodo === "update");
    expect(updates).toHaveLength(2); // o claim que não pegou + o update que só repõe no ar
    expect(chamadas.some((c) => c.tabela === "email_campaign_sends")).toBe(false);
    expect(inserçõesEm("notifications")).toHaveLength(0);
    expect(enviarLote).not.toHaveBeenCalled();
  });

  it("despublicar é só um update, sem claim e sem anúncio", async () => {
    const { toggleNewsPublished } = await import("./actions");

    expect(await toggleNewsPublished("post-1", false)).toEqual({});

    expect(chamadas.some((c) => c.tabela === "news_posts" && c.metodo === "is")).toBe(false);
    expect(inserçõesEm("notifications")).toHaveLength(0);
    expect(enviarLote).not.toHaveBeenCalled();
  });

  it("o e-mail de post novo continua desligado (ENVIAR_EMAIL_DE_POST_NOVO)", async () => {
    const { toggleNewsPublished } = await import("./actions");

    await toggleNewsPublished("post-1", true);

    // Ligar isto são ~4.550 e-mails no próximo post: é decisão da Jessica, e
    // este teste é o alarme para quem trocar a constante sem querer.
    expect(enviarLote).not.toHaveBeenCalled();
    expect(chamadas.some((c) => c.tabela === "email_campaign_sends")).toBe(false);
  });
});
