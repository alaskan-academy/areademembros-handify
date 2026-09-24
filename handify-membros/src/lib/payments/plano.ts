/**
 * O que fazer com o Handify Completo quando chega um pagamento do plano.
 *
 * Existe separado porque a decisão tem quatro casos e três deles são
 * silenciosos — errar não dá erro, só deixa a aluna sem os 23 cursos do plano
 * (e sem as ferramentas do tier) na data errada, sem aparecer em alarme nenhum.
 *
 * O caso que motivou: a aluna atrasa a assinatura, chega `subscription_late`, o
 * fim do plano é agendado em `memberships.expires_at`, ela paga o atraso e
 * chega `subscription_renewed`. Como a membership ainda não venceu, o código
 * antigo concluía "já está ativa, não preciso fazer nada" — e a data agendada
 * continuava lá. O plano morria na data, mesmo pago.
 *
 * ── Por que a regra NÃO olha quem concedeu ─────────────────────────────────
 *
 * A primeira versão só desfazia o agendamento quando `granted_by` era nulo,
 * para não transformar um plano de cortesia de 30 dias em vitalício. Três
 * revisões independentes derrubaram isso, e o banco deu razão a elas:
 *
 * - `granted_by` diz quem criou a LINHA, não quem escreveu a DATA. O ramo de
 *   revogação grava `expires_at` com `.eq("id", ...)` e nenhuma guarda de
 *   `granted_by`, então um agendamento do sistema pousa numa linha criada pela
 *   admin — e ali a regra antiga nunca o desfazia. Era o mesmo ciclo que esta
 *   função existe para fechar, sobrevivendo dentro do recorte.
 * - Na prática `granted_by` nem significa cortesia: a única linha que o tem
 *   preenchida em produção é uma compra paga que foi consertada à mão.
 * - E a FK é `on delete set null`: apagar o perfil da admin zeraria o
 *   `granted_by` de todas as concessões dela, mantendo as datas.
 *
 * A regra que ficou é a que se sustenta sozinha: **quem paga pelo plano fica
 * com o plano, sem data de fim**. Se a admin tinha dado um prazo e a aluna
 * comprou dentro dele, a compra vale mais que a cortesia — ela pagou. A troca
 * fica registrada em `audit_log` para a admin ver o que foi sobrescrito.
 *
 * NOTA para quando assinatura de verdade entrar: hoje comprar o plano concede
 * vitalício (o insert não põe `expires_at`), então limpar a data é coerente com
 * o resto. No dia em que a compra passar a ter prazo, esta função e o insert
 * mudam juntos — estão os dois no mesmo ramo.
 */

export type EstadoDoPlano = {
  /** Data de fim agendada, ou null quando é vitalício. */
  expires_at: string | null;
} | null;

export type DecisaoDoPlano =
  /** Não há plano em pé (ou o que havia venceu): criar um novo. */
  | "criar"
  /** Há plano em pé com data de fim: o pagamento a desfaz. */
  | "desfazer_agendamento"
  /** Não há nada a fazer. */
  | "nada";

export function decidirPlanoAoPagar(atual: EstadoDoPlano, agora: Date = new Date()): DecisaoDoPlano {
  if (!atual) return "criar";

  // Vitalício e em pé: o pagamento não muda nada.
  if (!atual.expires_at) return "nada";

  // Já passou da data: trata como não tendo plano — o chamador fecha a linha
  // velha e abre uma nova.
  if (new Date(atual.expires_at) <= agora) return "criar";

  // Há data de fim, ainda no futuro, e acabou de entrar dinheiro pelo plano.
  // A data não vale mais, tenha sido posta por quem for.
  return "desfazer_agendamento";
}
