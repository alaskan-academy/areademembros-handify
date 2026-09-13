/**
 * "O dinheiro voltou?" — a pergunta que já errou duas vezes.
 *
 * 09/09/2026: a regra perguntava se o E-MAIL tinha algum pagamento aprovado.
 * Quem comprou, gerou um segundo PIX depois e abandonou tinha o acesso pago
 * revogado pelo PIX que expirou. 24 alunas, 47 matrículas, cinco dias no ar.
 *
 * 13/09/2026: corrigida para perguntar sobre a TRANSAÇÃO — mas ainda olhando só
 * o nome do evento. A Payt manda praticamente tudo como "canceled" (1.517
 * eventos no histórico), e existem 4 transações que tiveram "paid" e depois um
 * "canceled" de PIX expirado: a compradora gerou dois PIX, pagou um e deixou o
 * outro vencer. Pelo nome do evento, as quatro seriam estorno.
 *
 * O payload separa os casos, em `transaction.payment_status`:
 *
 *   refunded        → o dinheiro voltou           (56 eventos)
 *   chargeback      → o dinheiro voltou           (3)
 *   expired         → PIX venceu, nada voltou     (4)
 *   paid            → só o pedido foi aberto      (51)
 *   peding_refund   → em análise, nada voltou     (31)  [sic, é assim que vem]
 *
 * Reembolso pedido e não concluído NÃO conta: a aluna pode desistir, e até o
 * dinheiro sair o acesso é dela.
 */

/** Estados em que a Payt afirma que o dinheiro saiu da conta. */
const STATUS_DE_DEVOLUCAO = ["refunded", "chargeback"];

/** Eventos que já dizem tudo pelo nome — é o formato da Kiwify, sem payment_status. */
const EVENTOS_DE_DEVOLUCAO = ["refunded", "order_refunded", "chargeback", "chargedback"];

/**
 * `payload` é o corpo bruto da plataforma; `eventType` é o rótulo já traduzido.
 *
 * Quando o payload traz `transaction.payment_status`, ele decide sozinho — é a
 * informação mais específica que a plataforma dá. Sem esse campo, cai no nome do
 * evento, que na Kiwify é explícito.
 */
export function dinheiroVoltou(
  payload: Record<string, unknown> | null | undefined,
  eventType: string
): boolean {
  const status = statusDaTransacao(payload);
  if (status) return STATUS_DE_DEVOLUCAO.includes(status);
  return EVENTOS_DE_DEVOLUCAO.includes(eventType);
}

/** `transaction.payment_status` do payload, quando existe. */
export function statusDaTransacao(
  payload: Record<string, unknown> | null | undefined
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const transacao = (payload as { transaction?: unknown }).transaction;
  if (!transacao || typeof transacao !== "object") return null;
  const status = (transacao as { payment_status?: unknown }).payment_status;
  return typeof status === "string" && status ? status : null;
}
