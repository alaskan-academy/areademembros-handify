import { test, expect } from "@playwright/test";
import crypto from "crypto";

/**
 * Testes de API para o webhook Kiwify.
 * Exercitam o endpoint diretamente via HTTP (sem browser), validando
 * assinatura, parsing e respostas esperadas.
 *
 * Nenhum dado real é modificado: o product_id usado não existe no banco.
 */

const WEBHOOK_PATH = "/api/webhooks/kiwify";

/** Monta payload mínimo no formato que a Kiwify envia. */
function makePayload(eventType = "order_approved"): Record<string, unknown> {
  return {
    order_id: `TEST-${Date.now()}`,
    order_ref: "e2e-ref",
    order_status: eventType === "order_approved" ? "paid" : "refunded",
    webhook_event_type: eventType,
    product_type: "membership",
    payment_method: "credit_card",
    Product: {
      product_id: "E2E_KIWIFY_CODE_INEXISTENTE",
      product_name: "Produto Teste E2E",
    },
    Customer: {
      full_name: "Aluna Teste E2E",
      first_name: "Aluna",
      email: "e2e-kiwify@handify-teste.com",
      mobile: "11999999999",
    },
    Commissions: { charge_amount: "9700", currency: "BRL" },
  };
}

/** Assina o corpo bruto igual a Kiwify faz (HMAC-SHA1 em hex). */
function sign(secret: string, rawBody: string): string {
  return crypto.createHmac("sha1", secret).update(rawBody, "utf8").digest("hex");
}

/** URL do webhook com a assinatura na query string. */
function urlWithSignature(secret: string, rawBody: string): string {
  return `${WEBHOOK_PATH}?signature=${sign(secret, rawBody)}`;
}

test.describe("Webhook Kiwify — validação", () => {
  test("GET retorna 405 Method Not Allowed", async ({ request }) => {
    const response = await request.get(WEBHOOK_PATH);
    expect(response.status()).toBe(405);
  });

  test("POST sem assinatura retorna 401", async ({ request }) => {
    const response = await request.post(WEBHOOK_PATH, { data: makePayload() });
    // Sem KIWIFY_WEBHOOK_SECRET configurado retorna 500 (misconfigured)
    expect([401, 500]).toContain(response.status());
  });

  test("assinatura inválida retorna 401", async ({ request }) => {
    const response = await request.post(`${WEBHOOK_PATH}?signature=${"0".repeat(40)}`, {
      data: makePayload(),
    });
    expect([401, 500]).toContain(response.status());
  });

  test("corpo adulterado depois de assinado retorna 401", async ({ request }) => {
    const secret = process.env.KIWIFY_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "KIWIFY_WEBHOOK_SECRET não configurado");
      return;
    }

    const original = JSON.stringify(makePayload());
    const tampered = original.replace("E2E_KIWIFY_CODE_INEXISTENTE", "OUTRO_PRODUTO");

    const response = await request.post(urlWithSignature(secret, original), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from(tampered, "utf8"),
    });
    expect(response.status()).toBe(401);
  });

  test("JSON inválido com assinatura correta retorna 400", async ({ request }) => {
    const secret = process.env.KIWIFY_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "KIWIFY_WEBHOOK_SECRET não configurado");
      return;
    }

    const raw = "nao_e_json{{";
    const response = await request.post(urlWithSignature(secret, raw), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from(raw, "utf8"),
    });
    expect(response.status()).toBe(400);
  });

  test("payload sem product_id retorna 400", async ({ request }) => {
    const secret = process.env.KIWIFY_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "KIWIFY_WEBHOOK_SECRET não configurado");
      return;
    }

    const raw = JSON.stringify({ ...makePayload(), Product: {} });
    const response = await request.post(urlWithSignature(secret, raw), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from(raw, "utf8"),
    });
    expect(response.status()).toBe(400);
  });

  test("order_approved com product_id inexistente retorna 200 com warning", async ({ request }) => {
    const secret = process.env.KIWIFY_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "KIWIFY_WEBHOOK_SECRET não configurado");
      return;
    }

    const raw = JSON.stringify(makePayload("order_approved"));
    const response = await request.post(urlWithSignature(secret, raw), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from(raw, "utf8"),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
    expect(body.warning).toBeTruthy();
  });

  test("order_refunded retorna 200", async ({ request }) => {
    const secret = process.env.KIWIFY_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "KIWIFY_WEBHOOK_SECRET não configurado");
      return;
    }

    const raw = JSON.stringify(makePayload("order_refunded"));
    const response = await request.post(urlWithSignature(secret, raw), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from(raw, "utf8"),
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).received).toBe(true);
  });

  test("pix_created (ignorado) retorna 200 sem warning de curso", async ({ request }) => {
    const secret = process.env.KIWIFY_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "KIWIFY_WEBHOOK_SECRET não configurado");
      return;
    }

    const raw = JSON.stringify(makePayload("pix_created"));
    const response = await request.post(urlWithSignature(secret, raw), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from(raw, "utf8"),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
    expect(body.warning).toBeUndefined();
  });
});
