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

import { dispararCampanha } from "./dispatch";

// ── Dublê do supabase-js ──────────────────────────────────────────

type Resultado = { data: unknown; error: unknown };

type Consulta = {
  tabela: string;
  op: "select" | "update" | "insert";
  corpo?: Record<string, unknown>;
  linhas?: unknown[];
  filtros: string[];
  faixa?: [number, number];
};

type Config = {
  status: string;
  target: string;
  alunas: string[];
  reivindicacaoGanha?: boolean;
  erroNaPaginaDePublico?: string;
  lotesQueFalham?: number[];
};

type Mundo = ReturnType<typeof criarMundo>;

function criarMundo(config: Config) {
  const chamadas: Consulta[] = [];
  let loteAtual = 0;

  function responder(q: Consulta): Resultado {
    if (q.tabela === "notification_campaigns") {
      if (q.op === "select") return { data: { status: config.status }, error: null };

      // A reivindicação é o único UPDATE que carrega o filtro `or`.
      const ehReivindicacao = q.filtros.some((f) => f.startsWith("or:"));
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
      select: () => construtor,
      update: (valores: Record<string, unknown>) => {
        q.op = "update";
        q.corpo = valores;
        return construtor;
      },
      insert: (linhas: unknown[]) => {
        q.op = "insert";
        q.linhas = linhas;
        return finalizar();
      },
      eq: (col: string, val: unknown) => {
        q.filtros.push(`eq:${col}=${String(val)}`);
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
      chamadas.find((c) => c.op === "update" && c.filtros.some((f) => f.startsWith("or:"))),
    updatesSimples: () =>
      chamadas.filter(
        (c) =>
          c.tabela === "notification_campaigns" &&
          c.op === "update" &&
          !c.filtros.some((f) => f.startsWith("or:"))
      ),
    inserts: () => chamadas.filter((c) => c.tabela === "notifications" && c.op === "insert"),
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
  it("pede a linha só em status reivindicável e retoma 'sending' velho", async () => {
    const mundo = criarMundo({ status: "scheduled", target: "all", alunas: alunas(3) });
    h.mundo = mundo as never;

    await dispararCampanha("camp-1");

    const claim = mundo.reivindicacao()!;
    expect(claim.corpo?.status).toBe("sending");
    expect(typeof claim.corpo?.sending_since).toBe("string");

    const filtro = claim.filtros.find((f) => f.startsWith("or:"))!;
    expect(filtro).toContain("status.in.(draft,scheduled,parcial)");
    expect(filtro).toContain("and(status.eq.sending,sending_since.is.null)");

    // O ISO tem pontos, que o PostgREST lê como separador de operador: sem as
    // aspas o filtro é recusado e a reivindicação nunca casa.
    const comAspas = filtro.match(/sending_since\.lt\."([^"]+)"/);
    expect(comAspas).not.toBeNull();
    const limite = new Date(comAspas![1]).getTime();
    expect(Date.now() - limite).toBeGreaterThanOrEqual(15 * 60_000 - 5_000);
    expect(Date.now() - limite).toBeLessThan(16 * 60_000);
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
    // "sending" para sempre: o cron só procura 'scheduled' e o painel não tem
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
