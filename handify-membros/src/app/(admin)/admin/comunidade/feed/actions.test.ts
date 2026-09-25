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
/** O que o claim do sino (`.is("notified_at", null)`) devolve. */
let claimDevolve: { id: string }[] = [];
/**
 * O que o claim do e-mail (`.is("emailed_at", null)`) devolve.
 *
 * São dois carimbos diferentes na mesma tabela e o mock precisa separá-los:
 * `notified_at` é o sino (carimbado pelo gatilho do banco no insert) e
 * `emailed_at` é o e-mail. Confundi-los foi o que deixou o teste antigo passar
 * ligado e desligado.
 */
let claimEmailDevolve: { id: string; title: string; body: string; published: boolean }[] = [];

function consulta(tabela: string) {
  const cadeia: string[] = [];
  let colunaDoIs: string | null = null;
  const alvo: Record<string, unknown> = {
    then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      let resultado: { data: unknown; error: unknown } = { data: null, error: null };
      if (tabela === "profiles" && cadeia.includes("single")) {
        resultado = { data: { role: "admin" }, error: null };
      } else if (tabela === "news_posts" && colunaDoIs === "emailed_at") {
        resultado = { data: claimEmailDevolve, error: null };
      } else if (tabela === "news_posts" && colunaDoIs === "notified_at") {
        resultado = { data: claimDevolve, error: null };
      } else if (tabela === "news_posts" && cadeia.includes("insert") && cadeia.includes("single")) {
        resultado = { data: { id: "post-novo" }, error: null };
      }
      return Promise.resolve(resultado).then(onOk, onErr);
    },
  };
  for (const metodo of ["select", "update", "insert", "upsert", "delete", "eq", "is", "not", "order", "range", "single"]) {
    alvo[metodo] = (...args: unknown[]) => {
      cadeia.push(metodo);
      if (metodo === "is") colunaDoIs = String(args[0]);
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
/**
 * `after()` roda depois da resposta em produção. Aqui ele guarda a promessa
 * para o teste poder esperar — senão a asserção corre antes do envio e o teste
 * passaria mesmo com o e-mail quebrado.
 */
const depoisDaResposta: Promise<unknown>[] = [];
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    depoisDaResposta.push(Promise.resolve().then(fn));
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFalso }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
// fetch-all começa com `import "server-only"`, que não resolve fora do bundler
// do Next — o mock evita carregar o módulo de verdade.
const buscarTudo = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/supabase/fetch-all", () => ({ fetchAll: (...a: unknown[]) => buscarTudo(...(a as [])) }));

const enviarLote = vi.fn(async () => ({ enviados: [] as string[], erro: null }));
vi.mock("@/lib/email", () => ({ sendNewsPostEmailBatch: enviarLote }));

beforeEach(() => {
  chamadas = [];
  claimDevolve = [{ id: "post-1" }];
  claimEmailDevolve = [{ id: "post-novo", title: "Aviso novo", body: "corpo", published: true }];
  depoisDaResposta.length = 0;
  enviarLote.mockClear();
  buscarTudo.mockReset();
  buscarTudo.mockResolvedValue([]);
});

/**
 * `notifyNewsPost` faz TRÊS `fetchAll`, nesta ordem: quem já recebeu, o
 * público, e quem tem matrícula ativa. Esta função arma as três respostas.
 *
 * `comMatricula` é a lista de ids com curso ativo. O padrão é "todas têm",
 * para os testes que não estão olhando isso não precisarem se importar.
 */
function comPublico(
  alunas: { id: string; email: string }[],
  jaReceberam: { user_id: string }[] = [],
  comMatricula: string[] = alunas.map((a) => a.id)
) {
  buscarTudo
    .mockResolvedValueOnce(jaReceberam)
    .mockResolvedValueOnce(alunas.map((a) => ({ ...a, full_name: "Aluna", email_prefs: null })))
    .mockResolvedValueOnce(comMatricula.map((id) => ({ user_id: id })));
}

/** Espera o que o `after()` agendou — o envio do e-mail acontece lá. */
async function esperarOAfter() {
  await Promise.all(depoisDaResposta);
}

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

  it("post NOVO publicado manda o e-mail, uma vez", async () => {
    // Este é o alarme de que o interruptor está ligado. Ele substitui um teste
    // que dizia "o e-mail continua desligado" e passava nos DOIS estados,
    // porque na verdade exercitava o claim de `notified_at` e nunca chegava
    // perto da constante. Alarme que não alarma é pior do que nenhum.
    comPublico([{ id: "a1", email: "aluna@exemplo.com" }]);
    enviarLote.mockResolvedValueOnce({ enviados: ["aluna@exemplo.com"], erro: null });
    const { createNewsPost } = await import("./actions");

    const form = new FormData();
    form.set("title", "Aviso novo");
    form.set("body", "corpo");
    form.set("published", "true");
    expect(await createNewsPost(form)).toEqual({});

    await esperarOAfter();

    const claim = chamadas.find(
      (c) => c.tabela === "news_posts" && c.metodo === "is" && c.args[0] === "emailed_at"
    );
    expect(claim?.args).toEqual(["emailed_at", null]);
    expect(enviarLote).toHaveBeenCalledTimes(1);
  });

  it("quem não tem curso ativo fica de fora — é a guarda de quem pediu reembolso", async () => {
    // Em 25/09/2026 a lista era o `profiles` inteiro: 4.735 endereços, 110 sem
    // nenhum curso, e 58 dessas 110 eram alunas estornadas. O e-mail as
    // levaria a uma plataforma onde elas não têm mais nada.
    comPublico(
      [
        { id: "aluna", email: "aluna@exemplo.com" },
        { id: "estornada", email: "estornada@exemplo.com" },
        { id: "nunca-comprou", email: "curiosa@exemplo.com" },
      ],
      [],
      ["aluna"] // só esta tem matrícula viva
    );
    enviarLote.mockResolvedValueOnce({ enviados: ["aluna@exemplo.com"], erro: null });
    const { createNewsPost } = await import("./actions");

    const form = new FormData();
    form.set("title", "Aviso novo");
    form.set("body", "corpo");
    form.set("published", "true");
    await createNewsPost(form);
    await esperarOAfter();

    expect(enviarLote).toHaveBeenCalledTimes(1);
    const fila = (enviarLote.mock.calls[0] as unknown as [{ to: string }[]])[0];
    expect(fila.map((d) => d.to)).toEqual(["aluna@exemplo.com"]);
  });

  it("ninguém com curso ativo: não manda e-mail nenhum, nem lote vazio", async () => {
    comPublico([{ id: "estornada", email: "estornada@exemplo.com" }], [], []);
    const { createNewsPost } = await import("./actions");

    const form = new FormData();
    form.set("title", "Aviso novo");
    form.set("body", "corpo");
    form.set("published", "true");
    await createNewsPost(form);
    await esperarOAfter();

    expect(enviarLote).not.toHaveBeenCalled();
  });

  it("post criado como rascunho não manda e-mail nenhum", async () => {
    const { createNewsPost } = await import("./actions");

    const form = new FormData();
    form.set("title", "Rascunho");
    form.set("body", "corpo");
    form.set("published", "false");
    await createNewsPost(form);
    await esperarOAfter();

    expect(enviarLote).not.toHaveBeenCalled();
  });

  it("post que já teve e-mail não manda de novo — é o que segura os antigos", async () => {
    // Todos os posts anteriores a 24/09/2026 foram carimbados na migration, e
    // é este caminho que os impede de disparar para as ~4.550 alunas.
    claimEmailDevolve = [];
    const { createNewsPost } = await import("./actions");

    const form = new FormData();
    form.set("title", "Aviso repetido");
    form.set("body", "corpo");
    form.set("published", "true");
    await createNewsPost(form);
    await esperarOAfter();

    expect(enviarLote).not.toHaveBeenCalled();
    expect(chamadas.some((c) => c.tabela === "email_campaign_sends")).toBe(false);
  });
});
