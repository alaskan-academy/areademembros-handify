import { NextRequest, NextResponse } from "next/server";
import {
  verifyPaytIntegrationKey,
  PaytPayloadSchema,
  classifyEvent,
  extractProductCodes,
  type PaytPayload,
} from "@/lib/payments/payt";
import { processPurchaseEvent } from "@/lib/payments/process-purchase";

export async function POST(req: NextRequest) {
  const secret = process.env.PAYT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[payt-webhook] PAYT_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Parsear e validar payload com Zod (rawJson preserva todos os campos da Payt)
  let payload: PaytPayload;
  let rawJson: Record<string, unknown>;
  try {
    rawJson = JSON.parse(await req.text());
    payload = PaytPayloadSchema.parse(rawJson);
  } catch (err) {
    console.warn("[payt-webhook] Payload inválido:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 2. Validar integration_key (autenticação do postback Payt)
  if (!verifyPaytIntegrationKey(secret, payload.integration_key)) {
    console.warn("[payt-webhook] integration_key inválida");
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  // 3. Normalizar e processar (mesma lógica usada pela Kiwify)
  return processPurchaseEvent({
    platform: "payt",
    source: "payt",
    eventType: payload.status,
    action: classifyEvent(payload.status),
    productCodes: extractProductCodes(payload),
    mainProductCode: payload.product.code,
    buyerEmail: payload.customer.email,
    buyerName: payload.customer.name?.trim() || undefined,
    buyerPhone: payload.customer.phone?.trim() || undefined,
    buyerDoc: payload.customer.doc,
    amountPaid: payload.transaction?.total_price ?? null,
    transactionId: payload.transaction_id,
    isRealRefund: ["refunded", "chargeback"].includes(payload.status),
    rawPayload: rawJson,
  });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
