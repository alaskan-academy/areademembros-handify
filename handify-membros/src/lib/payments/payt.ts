import crypto from "crypto";
import { z } from "zod";

// ── Payload Payt ─────────────────────────────────────────────────────────────

export const PaytPayloadSchema = z.object({
  event: z.string(),
  transaction_id: z.string(),
  product_code: z.string().min(1),
  buyer_email: z.string().email(),
  buyer_name: z.string().optional().default(""),
  amount: z.number().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
  // Estrutura real do Payt: dados do comprador
  customer: z
    .object({
      email: z.string().email().optional(),
      name: z.string().optional(),
      doc: z.string().optional(),   // CPF do comprador (11 dígitos)
      phone: z.string().optional(), // Telefone/WhatsApp do comprador
    })
    .optional(),
});

export type PaytPayload = z.infer<typeof PaytPayloadSchema>;

// ── Classificação de eventos ──────────────────────────────────────────────────

const GRANT_EVENTS = new Set([
  "payment.approved",
  "payment.completed",
  "payment.confirmed",
  "order.paid",
]);

const REVOKE_EVENTS = new Set([
  "payment.refunded",
  "payment.cancelled",
  "payment.chargeback",
  "payment.expired",
  "order.cancelled",
  "order.refunded",
]);

export function classifyEvent(event: string): "grant" | "revoke" | "ignore" {
  if (GRANT_EVENTS.has(event)) return "grant";
  if (REVOKE_EVENTS.has(event)) return "revoke";
  return "ignore";
}

// ── Validação HMAC ────────────────────────────────────────────────────────────

/**
 * Valida a assinatura HMAC-SHA256 enviada pelo Payt.
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

  // Ambos precisam ter o mesmo tamanho para timingSafeEqual
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
