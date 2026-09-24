import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `destravarCampanha` — a saída de uma campanha presa em "enviando".
 *
 * O que estes testes seguram, em ordem de estrago:
 *
 *  1. a ação NÃO dispara nada. Campanha que caiu no meio já entregou parte das
 *     notificações e `notifications` não tem dedupe: reenviar chega em
 *     duplicata para quem já recebeu, com a base em ~4.700 alunas;
 *  2. o status novo é decidido pela contagem real, não por chute;
 *  3. requireAdmin roda antes de qualquer UPDATE — "use server" publica toda
 *     função exportada do arquivo como endpoint POST;
 *  4. contagem que falha não vira sent_count inventado.
 *
 * Nada aqui toca banco: o cliente é um dublê que responde e anota.
 */

type Chamada = {
  tabela: string;
  op: "select" | "update" | "insert";
  corpo?: Record<string, unknown>;
  linhas?: unknown;
  filtros: string[];
};

let chamadas: Chamada[] = [];
let campanhaNoBanco: Record<string, unknown> | null = null;
/** Quantas linhas o UPDATE com `.eq("status","sending")` devolve. */
let updateGanha = true;
let roleDaSessao = "admin";

const contar = vi.fn(async () => ({ total: 0, aproximado: false }));
const disparar = vi.fn(async () => {});
const redirecionou = vi.fn();

function consulta(tabela: string) {
  const q: Chamada = { tabela, op: "select", filtros: [] };

  function responder() {
    chamadas.push(q);
    if (tabela === "profiles") return { data: { role: roleDaSessao }, error: null };
    if (tabela === "notification_campaigns") {
      if (q.op === "select") return { data: campanhaNoBanco, error: null };
      if (q.op === "update") {
        return { data: updateGanha ? { id: "camp-1" } : null, error: null };
      }
    }
    return { data: null, error: null };
  }

  const alvo: Record<string, unknown> = {
    select: () => alvo,
    update: (valores: Record<string, unknown>) => {
      q.op = "update";
      q.corpo = valores;
      return alvo;
    },
    insert: (linhas: unknown) => {
      q.op = "insert";
      q.linhas = linhas;
      return Promise.resolve(responder());
    },
    eq: (col: string, val: unknown) => {
      q.filtros.push(`${col}=${String(val)}`);
      return alvo;
    },
    order: () => alvo,
    maybeSingle: () => Promise.resolve(responder()),
    single: () => Promise.resolve(responder()),
    then: (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve(responder()).then(ok, err),
  };
  return alvo;
}

const clienteFalso = {
  auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
  from: (tabela: string) => consulta(tabela),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    redirecionou(destino);
    // O redirect do Next lança para interromper a execução. Sem isso o teste
    // mediria uma ação que seguiu em frente depois de "ser barrada".
    throw new Error(`NEXT_REDIRECT:${destino}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFalso }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
vi.mock("./dispatch", () => ({
  contarNotificacoesDaCampanha: (...args: unknown[]) =>
    (contar as unknown as (...a: unknown[]) => unknown)(...args),
  dispararCampanha: (...args: unknown[]) =>
    (disparar as unknown as (...a: unknown[]) => unknown)(...args),
}));

import { destravarCampanha } from "./actions";

const TRAVADA = {
  id: "camp-1",
  title: "Ferramentas novas na Handify",
  status: "sending",
  sending_since: "2026-09-24T10:00:00.000Z",
  sent_at: null,
  created_at: "2026-09-23T08:00:00.000Z",
};

beforeEach(() => {
  chamadas = [];
  campanhaNoBanco = { ...TRAVADA };
  updateGanha = true;
  roleDaSessao = "admin";
  contar.mockReset();
  contar.mockResolvedValue({ total: 0, aproximado: false });
  disparar.mockReset();
  redirecionou.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function updatesDaCampanha() {
  return chamadas.filter((c) => c.tabela === "notification_campaigns" && c.op === "update");
}

describe("destravarCampanha", () => {
  it("nunca dispara nada", async () => {
    contar.mockResolvedValue({ total: 2310, aproximado: false });

    await destravarCampanha("camp-1");

    // A asserção que mais importa do arquivo: a campanha que caiu no meio já
    // inseriu parte das notificações, e a tabela não tem dedupe. Redisparar
    // troca "presa" por "duplicada", que é pior.
    expect(disparar).not.toHaveBeenCalled();
    expect(chamadas.filter((c) => c.tabela === "notifications")).toHaveLength(0);
  });

  it("com gente alcançada vai para 'parcial' com a contagem real", async () => {
    contar.mockResolvedValue({ total: 2310, aproximado: false });

    const r = await destravarCampanha("camp-1");

    expect(r).toMatchObject({ success: true, total: 2310, status: "parcial" });
    const update = updatesDaCampanha()[0];
    expect(update.corpo).toMatchObject({
      status: "parcial",
      sent_count: 2310,
      sent_count_aproximado: false,
      sending_since: null,
      // Hora do disparo, não hora do clique no botão: é quando a aluna viu o
      // sino. Usar now() marcaria a campanha com dias de atraso.
      sent_at: TRAVADA.sending_since,
    });
  });

  it("sem ninguém alcançado volta para 'draft', e a admin decide", async () => {
    contar.mockResolvedValue({ total: 0, aproximado: false });

    const r = await destravarCampanha("camp-1");

    expect(r).toMatchObject({ success: true, total: 0, status: "draft" });
    expect(updatesDaCampanha()[0].corpo).toMatchObject({
      status: "draft",
      sent_count: 0,
      sent_at: null,
      sending_since: null,
    });
  });

  it("carrega o aviso de contagem aproximada para o painel", async () => {
    contar.mockResolvedValue({ total: 1000, aproximado: true });

    const r = await destravarCampanha("camp-1");

    expect(r.aproximado).toBe(true);
    expect(updatesDaCampanha()[0].corpo).toMatchObject({ sent_count_aproximado: true });
  });

  it("o UPDATE exige status 'sending' — dois cliques não brigam pela linha", async () => {
    contar.mockResolvedValue({ total: 10, aproximado: false });

    await destravarCampanha("camp-1");

    expect(updatesDaCampanha()[0].filtros).toEqual(["id=camp-1", "status=sending"]);
  });

  it("campanha que não está travada não é tocada", async () => {
    campanhaNoBanco = { ...TRAVADA, status: "sent", sent_count: 1000 };

    const r = await destravarCampanha("camp-1");

    expect(r.error).toBeTruthy();
    // Destravar uma campanha 'sent' sobrescreveria o sent_count verdadeiro por
    // uma contagem feita fora do disparo.
    expect(updatesDaCampanha()).toHaveLength(0);
    expect(contar).not.toHaveBeenCalled();
  });

  it("campanha inexistente não vira UPDATE", async () => {
    campanhaNoBanco = null;

    expect((await destravarCampanha("camp-1")).error).toBeTruthy();
    expect(updatesDaCampanha()).toHaveLength(0);
  });

  it("contagem que falha não grava número inventado", async () => {
    contar.mockRejectedValue(new Error("column campaign_id does not exist"));

    const r = await destravarCampanha("camp-1");

    expect(r.error).toBeTruthy();
    expect(updatesDaCampanha()).toHaveLength(0);
  });

  it("registra em audit_log o que foi feito e de onde veio o número", async () => {
    contar.mockResolvedValue({ total: 1000, aproximado: true });

    await destravarCampanha("camp-1");

    const log = chamadas.find((c) => c.tabela === "audit_log" && c.op === "insert");
    expect(log?.linhas).toMatchObject({
      admin_id: "admin-1",
      action: "notification_campaign.unlocked",
      target_type: "notification_campaign",
      target_id: "camp-1",
      meta: {
        status_novo: "parcial",
        notificacoes_contadas: 1000,
        contagem_aproximada: true,
        enviou_alguma_coisa: false,
      },
    });
  });

  it("aluna logada não destrava: requireAdmin barra antes de contar", async () => {
    // "use server" publica toda função exportada como endpoint POST — sem esta
    // guarda, qualquer visitante que forjasse o POST mexeria no status.
    roleDaSessao = "student";

    await expect(destravarCampanha("camp-1")).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirecionou).toHaveBeenCalledWith("/dashboard");
    expect(contar).not.toHaveBeenCalled();
    expect(updatesDaCampanha()).toHaveLength(0);
  });
});
