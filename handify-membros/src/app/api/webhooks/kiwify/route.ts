import { NextRequest, NextResponse } from "next/server";
import {
  verifyKiwifySignature,
  KiwifyPayloadSchema,
  classifyKiwifyEvent,
  isKiwifyRealRefund,
  kiwifyEventLabel,
  extractKiwifyProductCodes,
  extractKiwifyAmount,
  extractKiwifyBuyerName,
  extractKiwifyPhone,
  extractKiwifyDoc,
  type KiwifyPayload,
} from "@/lib/payments/kiwify";
import { processPurchaseEvent } from "@/lib/payments/process-purchase";

export async function POST(req: NextRequest) {
  const secret = process.env.KIWIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[kiwify-webhook] KIWIFY_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Corpo bruto — a assinatura é calculada sobre ele, antes de qualquer parse
  const rawBody = await req.text();

  // 2. Validar assinatura (vem na query string; header aceito como alternativa)
  const signature =
    req.nextUrl.searchParams.get("signature") ?? req.headers.get("x-kiwify-signature");

  if (!verifyKiwifySignature(secret, rawBody, signature)) {
    console.warn("[kiwify-webhook] assinatura inválida");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parsear e validar payload
  let payload: KiwifyPayload;
  let rawJson: Record<string, unknown>;
  try {
    rawJson = JSON.parse(rawBody);
    payload = KiwifyPayloadSchema.parse(rawJson);
  } catch (err) {
    console.warn("[kiwify-webhook] Payload inválido:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 4. Normalizar e processar (mesma lógica usada pela Payt)
  const productCodes = extractKiwifyProductCodes(payload);
  if (!productCodes.length) {
    console.warn("[kiwify-webhook] Payload sem product_id");
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  return processPurchaseEvent({
    platform: "kiwify",
    source: "kiwify",
    eventType: kiwifyEventLabel(payload),
    action: classifyKiwifyEvent(payload),
    productCodes,
    mainProductCode: productCodes[0],
    buyerEmail: payload.Customer.email,
    buyerName: extractKiwifyBuyerName(payload),
    buyerPhone: extractKiwifyPhone(payload),
    buyerDoc: extractKiwifyDoc(payload),
    amountPaid: extractKiwifyAmount(payload),
    transactionId: payload.order_id ?? payload.order_ref ?? "",
    isRealRefund: isKiwifyRealRefund(payload),
    rawPayload: rawJson,
  });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
