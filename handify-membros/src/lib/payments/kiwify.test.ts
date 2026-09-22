import { describe, it, expect } from "vitest";
import { KiwifyPayloadSchema, extractKiwifyAccessUntil } from "./kiwify";

/**
 * `subscription_canceled` e `subscription_late` cortavam o acesso na hora, como
 * se fossem estorno. Quem cancela no dia 2 já pagou o mês inteiro — e no Handify
 * Completo o corte leva 23 cursos de uma vez.
 *
 * A data do fim do ciclo vem no próprio payload do cancelamento. O que se testa
 * aqui é só a leitura dela: quando existe, quando não existe, e quando ela NÃO
 * pode virar agendamento (passado, inválida, acesso já encerrado). Todo payload
 * é inventado — nunca dado de aluna real.
 */

const futuro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const passado = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

/**
 * Monta o payload passando pelo schema de verdade. Assim o teste também prova
 * que `customer_access`/`next_payment` estão DECLARADOS no
 * `KiwifySubscriptionSchema` — antes eles só sobreviviam pelo `.passthrough()`,
 * sem acessor tipado, e era por isso que ninguém os lia.
 */
const payload = (Subscription?: Record<string, unknown>) =>
  KiwifyPayloadSchema.parse({
    order_id: "KWFY-TESTE-0001",
    webhook_event_type: "subscription_canceled",
    Customer: { email: "teste@exemplo.invalid", full_name: "Fulana de Teste" },
    Product: { product_id: "PRODUTO_DE_TESTE" },
    ...(Subscription ? { Subscription } : {}),
  });

describe("extractKiwifyAccessUntil", () => {
  it("devolve a data do fim do ciclo quando ela está no futuro", () => {
    // Formato real do payload da Kiwify: Subscription.customer_access.access_until
    // (o exemplo conferido em produção trazia "2026-10-21T03:00:00.000Z").
    const fim = extractKiwifyAccessUntil(
      payload({ customer_access: { has_access: true, access_until: futuro, active_period: true } })
    );
    expect(fim).toBe(futuro);
  });

  it("has_access false corta na hora, mesmo com access_until preenchido", () => {
    // A própria Kiwify já declarou que o acesso acabou. Agendar aqui daria à
    // aluna um mês que ela não tem.
    expect(
      extractKiwifyAccessUntil(
        payload({ customer_access: { has_access: false, access_until: futuro } })
      )
    ).toBeNull();
  });

  it("usa next_payment quando não vem customer_access", () => {
    expect(extractKiwifyAccessUntil(payload({ next_payment: futuro }))).toBe(futuro);
  });

  it("prefere access_until a next_payment quando os dois vêm", () => {
    const outro = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      extractKiwifyAccessUntil(
        payload({ customer_access: { access_until: futuro }, next_payment: outro })
      )
    ).toBe(futuro);
  });

  it("data no passado não agenda nada — é corte imediato", () => {
    expect(
      extractKiwifyAccessUntil(payload({ customer_access: { access_until: passado } }))
    ).toBeNull();
  });

  it("data inválida não agenda nada", () => {
    // Sem esta guarda, `new Date("amanhã")` viraria Invalid Date e o
    // `.toISOString()` lançaria dentro do webhook.
    expect(
      extractKiwifyAccessUntil(payload({ customer_access: { access_until: "amanhã" } }))
    ).toBeNull();
  });

  it("access_until null cai para null", () => {
    expect(
      extractKiwifyAccessUntil(payload({ customer_access: { has_access: true, access_until: null } }))
    ).toBeNull();
  });

  it("compra avulsa (sem Subscription) devolve null — estorno segue cortando na hora", () => {
    // order_refunded/chargeback de compra avulsa não tem Subscription nenhuma.
    // Este é o caso que NÃO pode virar agendamento: dinheiro devolvido, acesso
    // acaba agora.
    expect(extractKiwifyAccessUntil(payload())).toBeNull();
  });

  it("Subscription sem customer_access nem next_payment devolve null", () => {
    expect(extractKiwifyAccessUntil(payload({ id: "sub_123", status: "canceled" }))).toBeNull();
  });
});
