import { describe, it, expect } from "vitest";
import { dinheiroVoltou, statusDaTransacao } from "./estorno";

/** Payload da Payt, reduzido aos campos que a decisão usa. */
const payt = (payment_status: string | null) => ({
  transaction_id: "JX9ZKX3",
  ...(payment_status === null ? {} : { transaction: { payment_status, total_price: "0" } }),
});

describe("dinheiroVoltou", () => {
  it("reembolso concluído na Payt", () => {
    // Caso real: Lucia Nascimento, tx JX9ZKX3 — paid 12/08, canceled 14/08 com
    // payment_status "refunded" e total_price zerado.
    expect(dinheiroVoltou(payt("refunded"), "canceled")).toBe(true);
  });

  it("chargeback conta como devolução", () => {
    expect(dinheiroVoltou(payt("chargeback"), "chargeback")).toBe(true);
  });

  it("NÃO revoga PIX expirado depois de um pagamento", () => {
    // O caso que a versão anterior errava. Quatro transações reais chegaram
    // assim: a compradora gerou dois PIX, pagou um, o outro venceu — e o evento
    // de vencimento chega como "canceled", igual ao estorno.
    expect(dinheiroVoltou(payt("expired"), "canceled")).toBe(false);
  });

  it("NÃO revoga pedido de reembolso ainda não concluído", () => {
    // Até o dinheiro sair, o acesso é dela — ela pode desistir do pedido.
    expect(dinheiroVoltou(payt("paid"), "refund_requested")).toBe(false);
    expect(dinheiroVoltou(payt("peding_refund"), "refund_requested")).toBe(false);
  });

  it("NÃO revoga PIX que nunca foi pago", () => {
    expect(dinheiroVoltou(payt("waiting_payment"), "canceled")).toBe(false);
    expect(dinheiroVoltou(payt("expired"), "expired")).toBe(false);
  });

  it("sem payment_status, decide pelo nome do evento (Kiwify)", () => {
    expect(dinheiroVoltou(payt(null), "order_refunded")).toBe(true);
    expect(dinheiroVoltou(payt(null), "refunded")).toBe(true);
    expect(dinheiroVoltou(payt(null), "chargeback")).toBe(true);
    // "canceled" sozinho nunca basta: é o que a Payt manda para tudo.
    expect(dinheiroVoltou(payt(null), "canceled")).toBe(false);
    expect(dinheiroVoltou(payt(null), "subscription_canceled")).toBe(false);
  });

  it("payload ausente ou estranho não revoga nada por engano", () => {
    expect(dinheiroVoltou(null, "canceled")).toBe(false);
    expect(dinheiroVoltou(undefined, "canceled")).toBe(false);
    expect(dinheiroVoltou({}, "canceled")).toBe(false);
    expect(dinheiroVoltou({ transaction: null }, "canceled")).toBe(false);
    expect(dinheiroVoltou({ transaction: "refunded" }, "canceled")).toBe(false);
    expect(dinheiroVoltou({ transaction: { payment_status: 42 } }, "canceled")).toBe(false);
  });

  it("payment_status manda mais que o nome do evento", () => {
    // Se a plataforma diz que o dinheiro voltou, o rótulo do evento não importa.
    expect(dinheiroVoltou(payt("refunded"), "expired")).toBe(true);
    // E se diz que não voltou, um evento com nome de estorno não força a revogação.
    expect(dinheiroVoltou(payt("paid"), "refunded")).toBe(false);
  });
});

describe("statusDaTransacao", () => {
  it("lê o campo quando existe", () => {
    expect(statusDaTransacao(payt("refunded"))).toBe("refunded");
  });

  it("devolve null quando não existe", () => {
    expect(statusDaTransacao(payt(null))).toBeNull();
    expect(statusDaTransacao({ transaction: { payment_status: "" } })).toBeNull();
    expect(statusDaTransacao(null)).toBeNull();
  });
});
