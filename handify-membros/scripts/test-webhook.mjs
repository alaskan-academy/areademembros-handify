/**
 * Script de teste do webhook Payt.
 * Uso: node scripts/test-webhook.mjs [paid|canceled|waiting]
 *
 * Gera o HMAC correto e envia o payload contra o servidor local.
 * Requer que `npm run dev` esteja rodando em localhost:3000.
 */

import crypto from "crypto";

const SECRET = process.env.PAYT_WEBHOOK_SECRET ?? "a_definir";
const URL = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/payt";

// ── Payloads reais da Payt ────────────────────────────────────────────────────

const PAID = {
  integration_key: "8e820d583a121bdb552c6202638d8066",
  started_at: "2026-07-01 10:42:24.000000",
  updated_at: "2026-07-01 10:45:05.000000",
  seller_id: "RV65ZO",
  test: false,
  type: "order",
  tangible: false,
  cart_id: "KYZ5M28",
  status: "paid",
  transaction_id: "W9MYXAB",
  customer: {
    name: "Alaskan Academy",
    fake_email: false,
    email: "academyalaskan@gmail.com",
    doc: "59081684000146",
    phone: "27996388609",
    ip: "2804:7f5:b101:9a45:6d02:ebfe:1585:2708",
    url: "https://app.payt.com.br/admin/clientes/9OYJVMN/edit",
    code: "9OYJVMN",
  },
  product: {
    name: "Workshop Buquê de Velas",
    price: 4700,
    code: "R2JAJA",
    sku: "workshop-buque-de-velas",
    type: "digital",
    quantity: 1,
  },
  link: { title: "Workshop Buquê de Velas Rev1", sources: [], url: "https://payt.site/A1C7m7x", query_params: [] },
  transaction: {
    payment_method: "credit_card",
    payment_status: "paid",
    total_price: 4653,
    quantity: 1,
    modifiers: [],
    created_at: "2026-07-01 10:45:05",
    updated_at: "2026-07-01 10:45:05",
    paid_at: "2026-07-01 10:45:05",
    installments: 1,
    installment_price: 4653,
    price_without_installments: 4653,
  },
  commission: [
    { name: "PAYT TECNOLOGIA E EDUCACAO DIGITAL LTDA", email: "contato@payt.com.br", type: "platform", amount: 191 },
    { name: "ALASKAN ACADEMY LTDA", email: "academyalaskan@gmail.com", type: "producer", amount: 4321 },
  ],
};

const CANCELED = {
  ...PAID,
  status: "canceled",
  transaction: {
    ...PAID.transaction,
    payment_status: "refunded",
    total_price: 0,
    updated_at: "2026-07-01 10:49:07",
    error_message: "cancelado",
  },
  commission: [
    { name: "PAYT TECNOLOGIA E EDUCACAO DIGITAL LTDA", email: "contato@payt.com.br", type: "platform", amount: 0 },
    { name: "ALASKAN ACADEMY LTDA", email: "academyalaskan@gmail.com", type: "producer", amount: 0 },
  ],
};

const WAITING = {
  integration_key: "8e820d583a121bdb552c6202638d8066",
  started_at: "2026-07-01 10:54:28.000000",
  updated_at: "2026-07-01 10:56:06.000000",
  seller_id: "RV65ZO",
  test: false,
  type: "order",
  tangible: false,
  cart_id: "28O376X",
  status: "waiting_payment",
  transaction_id: "BEYMKZZ",
  customer: {
    name: "Daniele Cristine Cattaneo",
    fake_email: false,
    email: "daniiiicattaneo@gmail.com",
    doc: "33159015890",
    phone: "19994371860",
    ip: "170.81.237.149",
    url: "https://app.payt.com.br/admin/clientes/MA5WVPA/edit",
    code: "MA5WVPA",
  },
  product: {
    name: "Curso Saponaria Brasil",
    price: 4700,
    code: "RW2MMP",
    sku: "saponariabrasil",
    type: "digital",
    quantity: 1,
  },
  order_bumps: [
    {
      code: "4Z2E7L",
      name: "Combo Mestre da Saboaria em Casa",
      product: {
        name: "Combo Mestre da Saboaria em Casa 2.0",
        price: 5790,
        code: "4ED65E",
        sku: "combo-mestre-da-saboaria",
        type: "grouped",
        quantity: 1,
        items: [
          { name: "Arte Floral em Sabonetes 2.0", price: 3990, code: "L8M778", sku: "artefloral", type: "digital", quantity: 1 },
          { name: "Embalagens que Encantam 2.0", price: 9890, code: "4NGDDO", sku: "embalagensqueencantam", type: "digital", quantity: 1 },
          { name: "Kit Casa Cheirosa 2.0", price: 4100, code: "4MKB72", sku: "Kit Casa Cheirosa", type: "digital", quantity: 1 },
          { name: "Saboaria Energética: Purificação e Bem-Estar 2.0", price: 1970, code: "4M2WW6", sku: "saboariaenergetica", type: "digital", quantity: 1 },
          { name: "Natural Dermatológica 2.0", price: 1670, code: "R36XPZ", sku: "naturaldermatológica", type: "digital", quantity: 1 },
        ],
      },
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(body) {
  return "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

async function send(label, payload) {
  const body = JSON.stringify(payload);
  const sig = sign(body);

  console.log(`\n─── ${label} ───`);
  console.log(`  status: ${payload.status}`);
  console.log(`  email:  ${payload.customer.email}`);
  console.log(`  product_code: ${payload.product.code}`);
  console.log(`  assinando com secret: "${SECRET}"`);

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-payt-signature": sig,
    },
    body,
  });

  const text = await res.text();
  console.log(`  HTTP ${res.status}: ${text}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const arg = process.argv[2] ?? "paid";

if (arg === "paid")     await send("COMPRA (paid)", PAID);
else if (arg === "canceled") await send("CANCELAMENTO (canceled)", CANCELED);
else if (arg === "waiting")  await send("AGUARDANDO PAGAMENTO (waiting_payment)", WAITING);
else if (arg === "all") {
  await send("COMPRA (paid)", PAID);
  await send("CANCELAMENTO (canceled)", CANCELED);
  await send("AGUARDANDO PAGAMENTO (waiting_payment)", WAITING);
} else {
  console.error("Uso: node scripts/test-webhook.mjs [paid|canceled|waiting|all]");
  process.exit(1);
}
