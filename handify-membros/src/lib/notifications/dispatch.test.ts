import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes do disparo de campanha — o caminho que fala com a base inteira de uma
 * vez. Nada aqui toca banco nem Web Push: o service client é um dublê que
 * responde e anota o que foi pedido.
 */

const h = vi.hoisted(() => ({
  pushEnviados: [] as string[][],
  mundo: null as ReturnType<typeof criarMundoTipo> | null,
}));

// só para tipar o hoisted sem ciclo
declare function criarMundoTipo(): Mundo;

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/push", () => ({
  broadcastPush: async (_payload: unknown, ids: string[]) => {
    h.pushEnviados.push(ids);
    return ids.length;
  },
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => (h.mundo as unknown as Mundo).cliente(),
}));

import { contarNotificacoesDaCampanha, dispararCampanha } from "./dispatch";

// ── Dublê do supabase-js ──────────────────────────────────────────

type Resultado = { data: unknown; error: unknown; count?: number };

type Consulta = {
  tabela: string;
  op: "select" | "update" | "insert";
  corpo?: Record<string, unknown>;
  linhas?: Record<string, unknown>[];
  filtros: string[];
  faixa?: [number, number];
  contagem?: boolean;
};

type Config = {
  status: string;
  target: string;
  alunas: string[];
  reivindicacaoGanha?: boolean;
  erroNaPaginaDePublico?: string;
  lotesQueFalham?: number[];
  /** Quanto `count: exact` devolve para o filtro por campaign_id. */
  contagemPorCampanha?: number;
  /** Quanto `count: exact` devolve para o filtro por título. */
  contagemPorTitulo?: number;
  erroNaContagemPorCampanha?: string;
  erroNaContagemPorTitulo?: string;
};

type Mundo = ReturnType<typeof criarMundo>;

/** A reivindicação é o único UPDATE que filtra por uma lista de status. */
const FILTRO_DA_REIVINDICACAO = "in:status=";

function criarMundo(config: Config) {
  const chamadas: Consulta[] = [];
  let loteAtual = 0;

  function responder(q: Consulta): Resultado {
    if (q.tabela === "notification_campaigns") {
      if (q.op === "select") return { data: { status: config.status }, error: null };

      const ehReivindicacao = q.filtros.some((f) => f.startsWith(FILTRO_DA_REIVINDICACAO));
      if (!ehReivindicacao) return { data: null, error: null };
      if (config.reivindicacaoGanha === false) return { data: null, error: null };
      return {
        data: {
          id: "camp-1",
          title: "Ferramentas novas",
          body: "Passa lá no menu",
          link: null,
          target: config.target,
        },
        error: null,
      };
    }

    if (q.tabela === "profiles" || q.tabela === "enrollments") {
      if (config.erroNaPaginaDePublico) {
        return { data: null, error: { message: config.erroNaPaginaDePublico } };
      }
      const [de, ate] = q.faixa ?? [0, 0];
      const fatia = config.alunas.slice(de, ate + 1);
      return {
        data:
          q.tabela === "profiles"
            ? fatia.map((id) => ({ id }))
            : fatia.map((id) => ({ user_id: id })),
        error: null,
      };
    }

    if (q.tabela === "notifications") {
      // Contagem do destravamento: `count: exact, head: true` não traz linha
      // nenhuma — só o número.
      if (q.contagem) {
        const porCampanha = q.filtros.some((f) => f.startsWith("eq:campaign_id="));
        const erro = porCampanha
          ? config.erroNaContagemPorCampanha
          : config.erroNaContagemPorTitulo;
        if (erro) return { data: null, error: { message: erro } };
        return {
          data: null,
          error: null,
          count: porCampanha ? config.contagemPorCampanha ?? 0 : config.contagemPorTitulo ?? 0,
        };
      }
      const falhou = (config.lotesQueFalham ?? []).includes(loteAtual++);
      return { data: null, error: falhou ? { message: "lote recusado" } : null };
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
      select: (_colunas?: string, opcoes?: { count?: string; head?: boolean }) => {
        if (opcoes?.count) q.contagem = true;
        return construtor;
      },
      update: (valores: Record<string, unknown>) => {
        q.op = "update";
        q.corpo = valores;
        return construtor;
      },
      insert: (linhas: Record<string, unknown>[]) => {
        q.op = "insert";
        q.linhas = linhas;
        return finalizar();
      },
      eq: (col: string, val: unknown) => {
        q.filtros.push(`eq:${col}=${String(val)}`);
        return construtor;
      },
      gte: (col: string, val: unknown) => {
        q.filtros.push(`gte:${col}=${String(val)}`);
        return construtor;
      },
      in: (col: string, vals: readonly unknown[]) => {
        q.filtros.push(`in:${col}=${vals.join(",")}`);
        return construtor;
      },
      or: (filtro: string) => {
        q.filtros.push(`or:${filtro}`);
        return construtor;
      },
      range: (de: number, ate: number) => {
        q.faixa = [de, ate];
        return construtor;
      },
      maybeSingle: finalizar,
      single: finalizar,
      then: (aoResolver: (r: Resultado) => unknown, aoFalhar?: (e: unknown) => unknown) =>
        finalizar().then(aoResolver, aoFalhar),
    };
    return construtor;
  }

  return {
    cliente: () => ({ from }),
    chamadas,
    reivindicacao: () =>
      chamadas.find(
        (c) => c.op === "update" && c.filtros.some((f) => f.startsWith(FILTRO_DA_REIVINDICACAO))
      ),
    updatesSimples: () =>
      chamadas.filter(
        (c) =>
          c.tabela === "notification_campaigns" &&
          c.op === "update" &&
          !c.filtros.some((f) => f.startsWith(FILTRO_DA_REIVINDICACAO))
      ),
    inserts: () => chamadas.filter((c) => c.tabela === "notifications" && c.op === "insert"),
    contagens: () => chamadas.filter((c) => c.tabela === "notifications" && c.contagem),
  };
}

function alunas(quantas: number) {
  return Array.from({ length: quantas }, (_, i) => `aluna-${i}`);
}

beforeEach(() => {
  h.pushEnviados.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── Testes ────────────────────────────────────────────────────────

describe("reivindicação da campanha", () => {
  it("pede a linha só nos status reivindicáveis, e 'sending' não é um deles", async () => {
    const mundo = criarMundo({ status: "scheduled", target: "all", alunas: alunas(3) });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    const claim = mundo.reivindicacao()!;
    expect(claim.corpo?.status).toBe("sending");
    expect(typeof claim.corpo?.sending_since).toBe("string");

    const filtro = claim.filtros.find((f) => f.startsWith(FILTRO_DA_REIVINDICACAO))!;
    expect(filtro).toBe("in:status=draft,scheduled,parcial");

    // 'sending' fora da lista é o ponto: a retomada automática de 15 minutos que
    // existia aqui nunca rodava (o cron só procura 'scheduled', o painel não
    // oferecia botão) e, se rodasse, reinseriria a notificação e o push para
    // quem já tinha recebido — `notifications` não tem dedupe. A saída de
    // 'sending' é o botão "Destravar", que não reenvia nada.
    expect(filtro).not.toContain("sending");
    expect(claim.filtros.some((f) => f.startsWith("or:"))).toBe(false);
  });

  it("quem perde a corrida sai sem inserir nada", async () => {
    // Duplo clique em "Enviar agora", ou o cron por cima do envio manual: a
    // segunda chamada não leva a linha, e antes disso as duas inseriam a base
    // inteira — cada aluna recebia notificação e push em duplicata.
    const mundo = criarMundo({
      status: "sending",
      target: "all",
      alunas: alunas(1200),
      reivindicacaoGanha: false,
    });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    expect(mundo.inserts()).toHaveLength(0);
    expect(h.pushEnviados).toHaveLength(0);
    expect(mundo.updatesSimples()).toHaveLength(0);
  });
});

describe("contagem do que saiu", () => {
  it("grava sent_count e target_count quando tudo entra", async () => {
    const mundo = criarMundo({ status: "draft", target: "all", alunas: alunas(1200) });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    // 1.200 alunas: duas páginas de fetchAll e três lotes de insert.
    expect(mundo.inserts()).toHaveLength(3);
    const final = mundo.updatesSimples().at(-1)!;
    expect(final.corpo).toMatchObject({
      status: "sent",
      sent_count: 1200,
      target_count: 1200,
      sending_since: null,
    });
  });

  it("lote recusado vira 'parcial', não 'enviada'", async () => {
    const mundo = criarMundo({
      status: "draft",
      target: "all",
      alunas: alunas(1200),
      lotesQueFalham: [1],
    });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    const final = mundo.updatesSimples().at(-1)!;
    // 500 do primeiro lote + 200 do terceiro. O do meio não entrou — e é essa
    // diferença para o target_count que faz a admin enxergar o buraco.
    expect(final.corpo).toMatchObject({
      status: "parcial",
      sent_count: 700,
      target_count: 1200,
    });
  });

  it("público vazio fecha a campanha sem deixar sending_since sujo", async () => {
    const mundo = criarMundo({ status: "draft", target: "course:sem-ninguem", alunas: [] });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    expect(mundo.inserts()).toHaveLength(0);
    expect(mundo.updatesSimples().at(-1)!.corpo).toMatchObject({
      status: "sent",
      sent_count: 0,
      target_count: 0,
      sending_since: null,
    });
  });
});

describe("vínculo com a campanha", () => {
  it("todo lote carrega campaign_id em todas as linhas", async () => {
    // Sem esta coluna, campanha que morre no meio do disparo não deixa rastro
    // de quantas alunas já receberam: `sent_count` só é gravado no UPDATE
    // final, que nessa queda nunca roda.
    const mundo = criarMundo({ status: "draft", target: "all", alunas: alunas(1200) });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    const linhas = mundo.inserts().flatMap((c) => c.linhas ?? []);
    expect(linhas).toHaveLength(1200);
    expect(linhas.every((l) => l.campaign_id === "camp-1")).toBe(true);
  });
});

describe("push", () => {
  it("vai em fatias de 500", async () => {
    // `.in("user_id", ids)` viaja na query string do GET: a base inteira de uma
    // vez passa de 170 KB de URL e o gateway recusa — em silêncio, porque o
    // `.catch` engole.
    const mundo = criarMundo({ status: "draft", target: "all", alunas: alunas(1200) });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    expect(h.pushEnviados.map((f) => f.length)).toEqual([500, 500, 200]);
    expect(h.pushEnviados.flat()).toHaveLength(1200);
  });
});

describe("público que não pode ser montado", () => {
  it("devolve a campanha ao status anterior e propaga o erro", async () => {
    // fetchAll lança quando uma página falha. Sem isso a campanha ficava em
    // "sending" para sempre: o cron só procura 'scheduled' e o painel não tinha
    // botão para "enviando".
    const mundo = criarMundo({
      status: "scheduled",
      target: "all",
      alunas: alunas(10),
      erroNaPaginaDePublico: "connection reset",
    });
    h.mundo = mundo as never;

    await expect(dispararCampanha("camp-1")).rejects.toThrow(/fetchAll/);

    expect(mundo.inserts()).toHaveLength(0);
    expect(h.pushEnviados).toHaveLength(0);
    expect(mundo.updatesSimples().at(-1)!.corpo).toEqual({
      status: "scheduled",
      sending_since: null,
    });
  });
});

describe("contagem para destravar", () => {
  const travada = {
    id: "camp-1",
    title: "Ferramentas novas",
    sending_since: "2026-09-24T10:00:00.000Z",
    created_at: "2026-09-23T08:00:00.000Z",
  };

  function mundoVazio(config: Partial<Config>) {
    return criarMundo({ status: "sending", target: "all", alunas: [], ...config });
  }

  it("conta por campaign_id e não cai no título", async () => {
    const mundo = mundoVazio({ contagemPorCampanha: 2310, contagemPorTitulo: 99999 });
    h.mundo = mundo as never;

    expect(await contarNotificacoesDaCampanha(travada)).toEqual({
      total: 2310,
      aproximado: false,
    });

    // Uma consulta só, e com head: nada de somar linhas recebidas — foi assim
    // que a campanha de 05/09/2026 registrou 1.000 de 3.474.
    const contagens = mundo.contagens();
    expect(contagens).toHaveLength(1);
    expect(contagens[0].filtros).toEqual(["eq:campaign_id=camp-1"]);
  });

  it("campanha antiga cai no título, dentro da janela do disparo, e avisa que é aproximado", async () => {
    const mundo = mundoVazio({ contagemPorCampanha: 0, contagemPorTitulo: 1000 });
    h.mundo = mundo as never;

    expect(await contarNotificacoesDaCampanha(travada)).toEqual({
      total: 1000,
      aproximado: true,
    });

    // A janela começa em sending_since: campanha antiga de mesmo título ficou
    // do lado de fora da conta.
    const fallback = mundo.contagens().at(-1)!;
    expect(fallback.filtros).toEqual([
      "eq:type=admin_broadcast",
      "eq:title=Ferramentas novas",
      `gte:created_at=${travada.sending_since}`,
    ]);
  });

  it("sem sending_since a janela começa na criação da campanha", async () => {
    // Linha anterior a 22/09/2026 não tem sending_since. O começo da campanha é
    // o melhor limite que existe — melhor do que contar o banco inteiro.
    const mundo = mundoVazio({ contagemPorCampanha: 0, contagemPorTitulo: 7 });
    h.mundo = mundo as never;

    await contarNotificacoesDaCampanha({ ...travada, sending_since: null });

    expect(mundo.contagens().at(-1)!.filtros).toContain(
      `gte:created_at=${travada.created_at}`
    );
  });

  it("zero pelos dois caminhos é zero de verdade, não aproximado", async () => {
    // Disparo que caiu antes do primeiro lote. Duvidar de um número certo faria
    // o painel avisar "aproximado" sem motivo.
    const mundo = mundoVazio({ contagemPorCampanha: 0, contagemPorTitulo: 0 });
    h.mundo = mundo as never;

    expect(await contarNotificacoesDaCampanha(travada)).toEqual({
      total: 0,
      aproximado: false,
    });
  });

  it("erro na contagem estoura em vez de devolver 0", async () => {
    // Coluna ausente (migration não aplicada) ou consulta que falha: quem chama
    // precisa recusar o destravamento, não gravar um sent_count inventado.
    const mundo = mundoVazio({ erroNaContagemPorCampanha: "column campaign_id does not exist" });
    h.mundo = mundo as never;

    await expect(contarNotificacoesDaCampanha(travada)).rejects.toThrow(/campaign_id/);
  });
});
