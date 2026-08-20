import crypto from "crypto";
import { z } from "zod";

// ── Schemas ───────────────────────────────────────────────────────────────────

const KiwifyProductSchema = z
  .object({
    product_id: z.string().optional(),
    product_name: z.string().optional().default(""),
  })
  .passthrough();

const KiwifyCustomerSchema = z
  .object({
    email: z.string().email(),
    full_name: z.string().optional(),
    first_name: z.string().optional(),
    // A Kiwify manda o CPF em maiúsculas; alguns payloads antigos usam minúsculas.
    CPF: z.string().optional(),
    cpf: z.string().optional(),
    mobile: z.string().optional(),
    phone: z.string().optional(),
    ip: z.string().optional(),
  })
  .passthrough();

const KiwifyCommissionsSchema = z
  .object({
    // Valores vêm como string de centavos ("9700") em alguns eventos e como número em outros.
    charge_amount: z.union([z.string(), z.number()]).optional(),
    product_base_price: z.union([z.string(), z.number()]).optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const KiwifySubscriptionSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    plan: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const KiwifyPayloadSchema = z
  .object({
    order_id: z.string().optional(),
    order_ref: z.string().optional(),
    order_status: z.string().optional(),
    webhook_event_type: z.string().optional(),
    product_type: z.string().optional(),
    payment_method: z.string().optional(),
    approved_date: z.string().optional(),
    refunded_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    subscription_id: z.string().optional(),
    Product: KiwifyProductSchema.optional(),
    Customer: KiwifyCustomerSchema,
    Commissions: KiwifyCommissionsSchema.optional(),
    Subscription: KiwifySubscriptionSchema.optional(),
  })
  .passthrough();

export type KiwifyPayload = z.infer<typeof KiwifyPayloadSchema>;

// ── Autenticação por assinatura ───────────────────────────────────────────────

/**
 * A Kiwify assina o corpo bruto da requisição com HMAC e envia o resultado
 * em hexadecimal na query string (`?signature=...`).
 *
 * O algoritmo documentado é SHA-1. Aceitamos SHA-256 como alternativa porque a
 * Kiwify já mudou o algoritmo em versões anteriores da integração — ambas as
 * comparações usam o mesmo secret, então nenhuma delas enfraquece a validação.
 */
export function verifyKiwifySignature(
  secret: string,
  rawBody: string,
  signature: string | null
): boolean {
  if (!secret || !signature) return false;

  const candidates = [
    crypto.createHmac("sha1", secret).update(rawBody, "utf8").digest("hex"),
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"),
  ];

  const received = signature.trim().toLowerCase();
  return candidates.some((expected) => {
    if (expected.length !== received.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
    } catch {
      return false;
    }
  });
}

// ── Extração de product codes ─────────────────────────────────────────────────

/**
 * Retorna os identificadores de produto presentes na compra.
 *
 * Diferente da Payt, a Kiwify não agrupa order bumps no mesmo payload — cada
 * bump gera um webhook próprio. Sobra o produto principal e, em assinaturas,
 * o id do plano (que a admin pode cadastrar como código do curso).
 */
export function extractKiwifyProductCodes(payload: KiwifyPayload): string[] {
  const codes: string[] = [];

  if (payload.Product?.product_id) codes.push(payload.Product.product_id);

  // Alguns payloads repetem o id do produto na raiz.
  const rootProductId = (payload as Record<string, unknown>).product_id;
  if (typeof rootProductId === "string" && rootProductId) codes.push(rootProductId);

  if (payload.Subscription?.plan?.id) codes.push(payload.Subscription.plan.id);

  return [...new Set(codes.filter(Boolean))];
}

// ── Classificação de eventos ──────────────────────────────────────────────────

const GRANT_EVENTS = new Set(["order_approved", "subscription_renewed"]);
const REVOKE_EVENTS = new Set([
  "order_refunded",
  "chargeback",
  "subscription_canceled",
  "subscription_late",
]);

const GRANT_STATUSES = new Set(["paid", "approved"]);
const REVOKE_STATUSES = new Set(["refunded", "chargedback", "chargeback"]);

/**
 * Decide o que fazer com o evento. Prioriza `webhook_event_type` (mais
 * específico); cai para `order_status` quando o tipo não vier no payload.
 */
export function classifyKiwifyEvent(payload: KiwifyPayload): "grant" | "revoke" | "ignore" {
  const event = payload.webhook_event_type;
  if (event) {
    if (GRANT_EVENTS.has(event)) return "grant";
    if (REVOKE_EVENTS.has(event)) return "revoke";
    return "ignore";
  }

  const status = payload.order_status;
  if (status) {
    if (GRANT_STATUSES.has(status)) return "grant";
    if (REVOKE_STATUSES.has(status)) return "revoke";
  }
  return "ignore";
}

/** Só estorno de dinheiro dispara e-mail de reembolso — cancelamento de assinatura não. */
export function isKiwifyRealRefund(payload: KiwifyPayload): boolean {
  const event = payload.webhook_event_type;
  if (event) return event === "order_refunded" || event === "chargeback";
  return REVOKE_STATUSES.has(payload.order_status ?? "");
}

/** Rótulo do evento salvo em `payment_events.event_type`. */
export function kiwifyEventLabel(payload: KiwifyPayload): string {
  return payload.webhook_event_type ?? payload.order_status ?? "unknown";
}

// ── Extração de valores ───────────────────────────────────────────────────────

/** Valor pago em centavos (mesma unidade usada pela Payt em `payment_events.amount_paid`). */
export function extractKiwifyAmount(payload: KiwifyPayload): number | null {
  const raw = payload.Commissions?.charge_amount ?? payload.Commissions?.product_base_price;
  if (raw == null) return null;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Nome do comprador, preferindo o nome completo. */
export function extractKiwifyBuyerName(payload: KiwifyPayload): string | undefined {
  const name = payload.Customer.full_name?.trim() || payload.Customer.first_name?.trim();
  return name || undefined;
}

/** Telefone do comprador (a Kiwify usa `mobile`). */
export function extractKiwifyPhone(payload: KiwifyPayload): string | undefined {
  return payload.Customer.mobile?.trim() || payload.Customer.phone?.trim() || undefined;
}

/** CPF do comprador, só dígitos. */
export function extractKiwifyDoc(payload: KiwifyPayload): string | undefined {
  return payload.Customer.CPF ?? payload.Customer.cpf ?? undefined;
}
