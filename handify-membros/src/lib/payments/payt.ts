import crypto from "crypto";
import { z } from "zod";

// ── Schemas ───────────────────────────────────────────────────────────────────

const PaytProductItemSchema = z.object({
  code: z.string(),
  type: z.string().optional().default("digital"),
  name: z.string().optional().default(""),
});

const PaytOrderBumpSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  product: PaytProductItemSchema.extend({
    items: z.array(PaytProductItemSchema).optional().default([]),
  }),
});

export const PaytPayloadSchema = z.object({
  status: z.string(),                    // "paid" | "refunded" | "cancelled" | "chargeback" | ...
  transaction_id: z.string(),
  test: z.boolean().optional().default(false),
  customer: z.object({
    email: z.string().email(),
    name: z.string().optional().default(""),
    doc: z.string().optional(),          // CPF (11 dígitos)
    phone: z.string().optional(),
  }),
  product: z.object({
    code: z.string(),
    type: z.string().optional().default("digital"),
    name: z.string().optional().default(""),
    items: z.array(PaytProductItemSchema).optional().default([]),
  }),
  order_bumps: z.array(PaytOrderBumpSchema).optional().default([]),
});

export type PaytPayload = z.infer<typeof PaytPayloadSchema>;

// ── Extração de product codes ─────────────────────────────────────────────────

/**
 * Retorna todos os product codes presentes na compra:
 * - Produto agrupado (grouped): usa os codes de cada item individual
 * - Produto simples: usa o code do produto
 * - Order bumps: adiciona o code de cada OB
 */
export function extractProductCodes(payload: PaytPayload): string[] {
  const codes: string[] = [];

  if (payload.product.type === "grouped" && payload.product.items.length > 0) {
    for (const item of payload.product.items) {
      if (item.code) codes.push(item.code);
    }
  } else {
    codes.push(payload.product.code);
  }

  for (const bump of payload.order_bumps) {
    if (bump.product?.type === "grouped" && bump.product.items?.length) {
      for (const item of bump.product.items) {
        if (item.code) codes.push(item.code);
      }
    } else if (bump.product?.code) {
      codes.push(bump.product.code);
    }
  }

  return [...new Set(codes)]; // remove duplicatas
}

// ── Classificação de status ───────────────────────────────────────────────────

const GRANT_STATUSES = new Set(["paid", "approved", "completed", "confirmed"]);
const REVOKE_STATUSES = new Set(["refunded", "cancelled", "canceled", "chargeback", "expired"]);

export function classifyEvent(status: string): "grant" | "revoke" | "ignore" {
  if (GRANT_STATUSES.has(status)) return "grant";
  if (REVOKE_STATUSES.has(status)) return "revoke";
  return "ignore";
}

// ── Validação HMAC ────────────────────────────────────────────────────────────

/**
 * Valida assinatura HMAC-SHA256 do Payt.
 * Header esperado: X-Payt-Signature: sha256=<hex>
 * Usa timingSafeEqual para prevenir timing attacks.
 */
export function verifyPaytSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (expected.length !== signatureHeader.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signatureHeader, "utf8")
    );
  } catch {
    return false;
  }
}
