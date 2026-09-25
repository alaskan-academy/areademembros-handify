import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Um reembolso, um e-mail.
 *
 * `sendRefundEmail` ficava DENTRO do `courses.map()` que revoga as matrículas.
 * Como o código do Handify Completo está cadastrado nos 23 cursos, quem pedia
 * reembolso do plano recebia 23 e-mails "Seu reembolso foi processado" no mesmo
 * segundo, cada um citando um curso diferente.
 *
 * Medido no audit_log em 25/09/2026, cruzando `enrollment.revoked` com as
 * transações de estorno real: 6 pessoas levaram 23 e-mails, uma levou 22,
 * quatro levaram 6, e só 14 das 30 receberam o número certo, que é um.
 *
 * É o tipo de coisa que vira denúncia de spam — e quem recebe acabou de pedir o
 * dinheiro de volta, ou seja, já não estava contente.
 */

type Chamada = { tabela: string; metodo: string; args: unknown[] };
let chamadas: Chamada[] = [];

/** Cursos que a compra cobre — é o tamanho disto que gerava o enxame. */
let cursosDaCompra: { id: string; title: string; access_days: number | null; checkout_codes: string[] }[] = [];
/** A matrícula existe? (sem matrícula o laço sai antes de revogar) */
let temMatricula = true;
/** A guarda "o curso está pago por outra compra em pé" */
let protegido = false;

function construtor(tabela: string) {
  const cadeia: string[] = [];
  const alvo: Record<string, unknown> = {
    then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      let r: { data: unknown; error: unknown } = { data: null, error: null };
      if (tabela === "courses") r = { data: cursosDaCompra, error: null };
      else if (tabela === "profiles" && cadeia.includes("maybeSingle")) {
        r = { data: { id: "aluna-1", email: "aluna@exemplo.com", full_name: "Ana Maria" }, error: null };
      } else if (tabela === "enrollments" && cadeia.includes("maybeSingle")) {
        r = { data: temMatricula ? { id: "m1", expires_at: null } : null, error: null };
      } else if (tabela === "annual_promo") {
        // Sem códigos de plano: o bloco do Handify Completo fica de fora e o
        // teste olha só o que interessa, que é o e-mail do reembolso.
        r = { data: { subscription_product_codes: [] }, error: null };
      }
      return Promise.resolve(r).then(onOk, onErr);
    },
  };
  for (const m of [
    "select", "insert", "update", "upsert", "delete",
    "eq", "in", "is", "not", "ilike", "filter", "overlaps", "or", "order", "range", "limit",
    "maybeSingle", "single",
  ]) {
    alvo[m] = (...args: unknown[]) => {
      cadeia.push(m);
      chamadas.push({ tabela, metodo: m, args });
      return alvo;
    };
  }
  return alvo;
}

const clienteFalso = {
  from: (tabela: string) => construtor(tabela),
  rpc: async (nome: string) =>
    nome === "curso_coberto_por_outra_compra"
      ? { data: protegido, error: null }
      : { data: null, error: null },
};

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFalso }));
vi.mock("next/server", () => ({
  NextResponse: { json: (body: unknown) => ({ body }) },
}));

const mandarReembolso = vi.fn(async () => {});
const mandarAcesso = vi.fn(async () => {});
vi.mock("@/lib/email", () => ({
  sendRefundEmail: (...a: unknown[]) => mandarReembolso(...(a as [])),
  sendAccessConfirmedEmail: (...a: unknown[]) => mandarAcesso(...(a as [])),
}));
vi.mock("@/lib/cpf-crypto", () => ({ encryptCpf: () => "x", hashCpf: () => "y" }));
vi.mock("@/lib/auth/vincular-compra", () => ({ contaDaMesmaPessoa: async () => null }));

import { processPurchaseEvent, type PurchaseEvent } from "./process-purchase";

function estorno(qtdCursos: number): PurchaseEvent {
  cursosDaCompra = Array.from({ length: qtdCursos }, (_, i) => ({
    id: `curso-${i + 1}`,
    title: `Curso ${i + 1}`,
    access_days: null,
    checkout_codes: ["LPGKQ8"],
  }));
  return {
    platform: "payt",
    source: "payt",
    eventType: "canceled",
    action: "revoke",
    productCodes: ["LPGKQ8"],
    mainProductCode: "LPGKQ8",
    buyerEmail: "aluna@exemplo.com",
    buyerName: "Ana Maria",
    amountPaid: null,
    transactionId: "TX-1",
    isRealRefund: true,
    rawPayload: {},
  };
}

type ArgsDoReembolso = { to: string; studentName: string; courseTitles: string[] };

/** O que foi passado para `sendRefundEmail` na chamada `i`. */
function argumentos(i = 0): ArgsDoReembolso {
  const chamada = mandarReembolso.mock.calls[i] as unknown as [ArgsDoReembolso] | undefined;
  if (!chamada) throw new Error(`sendRefundEmail não foi chamada ${i + 1}x`);
  return chamada[0];
}

beforeEach(() => {
  chamadas = [];
  temMatricula = true;
  protegido = false;
  mandarReembolso.mockClear();
  mandarAcesso.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("e-mail de reembolso: um por reembolso, não um por curso", () => {
  it("reembolso do plano (23 cursos) manda UM e-mail com os 23 títulos", async () => {
    await processPurchaseEvent(estorno(23));
    await new Promise((r) => setTimeout(r, 0)); // o envio é disparado sem await

    expect(mandarReembolso).toHaveBeenCalledTimes(1);
    expect(argumentos().courseTitles).toHaveLength(23);
    expect(argumentos().courseTitles[0]).toBe("Curso 1");
    expect(argumentos().courseTitles[22]).toBe("Curso 23");
  });

  it("reembolso de um curso só continua mandando um e-mail com um título", async () => {
    await processPurchaseEvent(estorno(1));
    await new Promise((r) => setTimeout(r, 0));

    expect(mandarReembolso).toHaveBeenCalledTimes(1);
    expect(argumentos().courseTitles).toEqual(["Curso 1"]);
  });

  it("manda para o e-mail da conta e usa o nome do perfil", async () => {
    await processPurchaseEvent(estorno(3));
    await new Promise((r) => setTimeout(r, 0));

    expect(argumentos().to).toBe("aluna@exemplo.com");
    expect(argumentos().studentName).toBe("Ana Maria");
  });
});

describe("quem NÃO deve receber", () => {
  it("cancelamento sem dinheiro de volta (PIX expirado) não manda e-mail nenhum", async () => {
    // Dizer "seu reembolso foi processado" para quem abandonou um PIX é mentira,
    // e foi o que quase aconteceu em 09/09/2026 com 24 alunas.
    await processPurchaseEvent({ ...estorno(5), isRealRefund: false });
    await new Promise((r) => setTimeout(r, 0));

    expect(mandarReembolso).not.toHaveBeenCalled();
  });

  it("sem matrícula para revogar, não há o que avisar", async () => {
    temMatricula = false;
    await processPurchaseEvent(estorno(4));
    await new Promise((r) => setTimeout(r, 0));

    expect(mandarReembolso).not.toHaveBeenCalled();
  });

  it("curso protegido por outra compra em pé fica fora da lista do e-mail", async () => {
    // O acesso continua, então o e-mail não pode dizer que ela o perdeu.
    protegido = true;
    await processPurchaseEvent(estorno(23));
    await new Promise((r) => setTimeout(r, 0));

    expect(mandarReembolso).not.toHaveBeenCalled();
  });
});
