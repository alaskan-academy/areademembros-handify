import { test, expect } from "@playwright/test";

/**
 * Testes de API para o webhook Payt.
 * Estes testes exercitam o endpoint diretamente via HTTP (sem browser),
 * validando autenticação, parsing e respostas esperadas.
 *
 * Nenhum dado real é modificado: os product codes usados não existem no banco.
 */

const WEBHOOK_URL = "/api/webhooks/payt";

/** Monta payload mínimo válido com a integration_key fornecida. */
function makePayload(integrationKey: string, status = "paid"): Record<string, unknown> {
  return {
    integration_key: integrationKey,
    status,
    transaction_id: `TEST-${Date.now()}`,
    test: true,
    customer: {
      email: "e2e-test@handify-teste.com",
      name: "Aluna Teste E2E",
    },
    product: {
      code: "E2E_CODE_INEXISTENTE",
      type: "digital",
      name: "Produto Teste E2E",
    },
  };
}

test.describe("Webhook Payt — validação", () => {
  test("GET retorna 405 Method Not Allowed", async ({ request }) => {
    const response = await request.get(WEBHOOK_URL);
    expect(response.status()).toBe(405);
  });

  test("payload sem JSON válido retorna 400", async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      headers: { "Content-Type": "application/json" },
      data: "nao_e_json{{",
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("payload sem integration_key retorna 400", async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: {
        status: "paid",
        transaction_id: "MISSING-KEY",
        customer: { email: "test@test.com" },
        product: { code: "ABC" },
      },
    });
    expect(response.status()).toBe(400);
  });

  test("integration_key incorreta retorna 401", async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: makePayload("CHAVE_COMPLETAMENTE_ERRADA"),
    });
    // Se PAYT_WEBHOOK_SECRET não estiver configurado, retorna 500 (misconfigured)
    // Se estiver configurado, chave errada retorna 401
    expect([401, 500]).toContain(response.status());
  });

  test("payload válido com product code inexistente retorna 200 com warning", async ({
    request,
  }) => {
    const secret = process.env.PAYT_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "PAYT_WEBHOOK_SECRET não configurado — pulando teste de payload válido");
      return;
    }

    const response = await request.post(WEBHOOK_URL, {
      data: makePayload(secret),
    });

    // Deve retornar 200 (recebeu ok, mas sem curso para matricular)
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
    // Deve informar que não encontrou curso
    expect(body.warning).toBeTruthy();
  });

  test("status 'refunded' com product code inexistente retorna 200", async ({ request }) => {
    const secret = process.env.PAYT_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "PAYT_WEBHOOK_SECRET não configurado");
      return;
    }

    const response = await request.post(WEBHOOK_URL, {
      data: makePayload(secret, "refunded"),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
  });

  test("status 'expired' (ignorado) retorna 200", async ({ request }) => {
    const secret = process.env.PAYT_WEBHOOK_SECRET;
    if (!secret) {
      test.skip(true, "PAYT_WEBHOOK_SECRET não configurado");
      return;
    }

    const response = await request.post(WEBHOOK_URL, {
      data: makePayload(secret, "expired"),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
  });
});
