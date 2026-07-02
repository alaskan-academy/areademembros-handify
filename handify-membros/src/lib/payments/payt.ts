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
  integration_key: z.string(),            // chave de autenticação do postback
  status: z.string(),                     // "paid" | "refunded" | "canceled" | "chargeback" | ...
  transaction_id: z.string(),
  test: z.boolean().optional().default(false),
  customer: z.object({
    email: z.string().email(),
    name: z.string().optional().default(""),
    doc: z.string().optional(),           // CPF (11 dígitos) ou CNPJ
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

// ── Autenticação por integration_key ─────────────────────────────────────────

/**
 * Payt usa postbacks simples (sem header de assinatura).
 * A autenticação é feita comparando o integration_key do payload
 * com o secret configurado em PAYT_WEBHOOK_SECRET.
 * Usa timingSafeEqual para prevenir timing attacks.
 */
export function verifyPaytIntegrationKey(
  secret: string,
  integrationKey: string
): boolean {
  if (!integrationKey || !secret) return false;
  if (secret.length !== integrationKey.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secret, "utf8"),
      Buffer.from(integrationKey, "utf8")
    );
  } catch {
    return false;
  }
}

// ── Extração de product codes ─────────────────────────────────────────────────

/**
 * Retorna todos os product codes presentes na compra:
 * - Produto agrupado (grouped): usa os codes de cada item individual
 * - Produto simples: usa o code do produto
 * - Order bumps: adiciona o code de cada OB (idem, agrupado → itens)
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

  return [...new Set(codes)];
}

// ── Classificação de status ───────────────────────────────────────────────────

const GRANT_STATUSES = new Set(["paid", "approved", "completed", "confirmed"]);
const REVOKE_STATUSES = new Set(["refunded", "cancelled", "canceled", "chargeback", "expired"]);

export function classifyEvent(status: string): "grant" | "revoke" | "ignore" {
  if (GRANT_STATUSES.has(status)) return "grant";
  if (REVOKE_STATUSES.has(status)) return "revoke";
  return "ignore";
}
