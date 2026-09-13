-- ─── Estorno é o que o payload diz, não o nome do evento ─────────────────────
--
-- A primeira versão de `compra_estornada` olhava o event_type: "paid" seguido de
-- canceled/refund_requested/... na mesma transação. Isso ainda carregava o erro
-- de 09/09/2026 numa forma mais sutil.
--
-- A Payt manda quase tudo como "canceled" (1.517 eventos; "refunded" só existe
-- desde 03/09 e vem da Kiwify). O que separa os casos está DENTRO do payload,
-- em transaction.payment_status:
--
--   canceled + payment_status=refunded   → estorno concluído (56 eventos)
--   canceled + payment_status=expired    → PIX que venceu      (4 eventos)
--   refund_requested + payment_status=paid          → só pedido (51)
--   refund_requested + payment_status=peding_refund → em análise (31)
--   chargeback + payment_status=chargeback          → estorno    (3)
--
-- Ou seja: existem 4 transações que tiveram "paid" e depois um "canceled" de PIX
-- expirado. A regra anterior chamaria as quatro de estorno — exatamente o tipo de
-- confusão que tirou o acesso pago de 24 alunas em 09/09.
--
-- No fluxo real o estorno concluído é sempre:
--   paid → refund_requested(paid) → refund_requested(peding_refund)
--        → canceled(payment_status=refunded, total_price=0)
--
-- Pedido de reembolso ainda não concluído NÃO conta: a aluna pode desistir, e
-- até o dinheiro voltar o acesso é dela. São 6 transações e R$667,90 hoje.
create or replace function public.compra_estornada(
  p_email text,
  p_transaction_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with tx as (
    select
      pe.payload->>'transaction_id' as transacao,
      max(pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ) as pago_em,
      -- A prova do estorno é o payload, não o rótulo do evento. O fallback por
      -- event_type cobre a Kiwify, que manda refunded/chargeback sem esse campo.
      max(pe.created_at) filter (
        where pe.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
           or (pe.payload->'transaction'->>'payment_status' is null
               and pe.event_type in ('refunded','order_refunded','chargeback','chargedback'))
      ) as estorno_em
    from public.payment_events pe
    where lower(pe.buyer_email) = lower(p_email)
      and pe.payload->>'transaction_id' is not null
      and (p_transaction_id is null or pe.payload->>'transaction_id' = p_transaction_id)
    group by 1
  )
  select exists (
    select 1 from tx
    where pago_em is not null
      and estorno_em is not null
      and estorno_em > pago_em
  );
$$;

comment on function public.compra_estornada(text, text) is
  'true quando a transação foi paga e o dinheiro voltou. Lê transaction.payment_status do payload — "canceled" sozinho não basta, porque PIX expirado também chega como canceled.';

revoke all on function public.compra_estornada(text, text) from anon, authenticated;
