-- ─── A trava anti-revogação também era cega para a Kiwify ───────────────────
--
-- `curso_coberto_por_outra_compra` responde "outra compra em pé desta pessoa já
-- cobre este curso?" e é consultada ANTES de revogar. É ela que impede o caso
-- da Carla, de 19/09/2026: comprou o Handify Completo às 15:37 e de novo às
-- 15:44 por engano, pediu reembolso do segundo, e perdeu o plano inteiro que já
-- tinha pago.
--
-- Só que ela chaveia por `payload->>'transaction_id'` e exige o campo não nulo —
-- a mesma cegueira que `compra_estornada` tinha. Medido em 24/09/2026: dos 63
-- eventos da Kiwify, ZERO têm `transaction_id`; a Kiwify identifica a transação
-- por `order_id`. Ou seja, nenhuma compra da Kiwify entra na conta, e a
-- proteção não existe para essa plataforma.
--
-- Hoje não morde: não houve estorno na Kiwify e nenhum código de plano chegou
-- por lá. Morde no primeiro — e o estrago é o da Carla, com o agravante de a
-- Kiwify já estar rodando assinatura (6 `subscription_renewed` e 23
-- `order_approved` no banco).
--
-- Os commits de 24/09 corrigiram `compra_estornada`,
-- `process_pending_payment_events`, `sync_membership_from_payments` e a
-- matrícula retroativa com o mesmo `coalesce`. Esta função ficou de fora; uma
-- revisão adversarial a pegou.
--
-- De quebra: `p_transacao` nulo fazia a função devolver SEMPRE false, porque
-- `x <> null` é null e a linha some do filtro. Nenhum chamador passa nulo hoje
-- (process-purchase.ts manda o id nas duas chamadas), mas um dia passaria e a
-- trava desligaria em silêncio.

create or replace function public.curso_coberto_por_outra_compra(
  p_email     text,
  p_course_id uuid,
  p_transacao text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with eu as (select public.emails_da_pessoa(p_email) as emails),
  tx as (
    select
      -- Payt manda transaction_id; Kiwify manda order_id.
      coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') as transacao,
      max(pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ) as pago_em,
      max(pe.created_at) filter (
        where pe.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
           or (pe.payload->'transaction'->>'payment_status' is null
               and pe.event_type in ('refunded','order_refunded','chargeback','chargedback','canceled','cancelled'))
      ) as estorno_em,
      (array_agg(pe.payload order by pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ))[1] as pl,
      (array_agg(pe.product_code order by pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ))[1] as codigo_principal
    from public.payment_events pe, eu
    where lower(pe.buyer_email) = any(eu.emails)
      and coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') is not null
      -- `p_transacao is null or ...`: sem isto, chamada sem transação devolvia
      -- false sempre, porque `x <> null` é null e a linha sumia do filtro.
      and (p_transacao is null
           or coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') <> p_transacao)
      and coalesce((pe.payload->>'test')::boolean, false) = false
    group by 1
  ),
  boas as (select * from tx where pago_em is not null and (estorno_em is null or estorno_em < pago_em)),
  codigos as (
    select z.cod from boas b cross join lateral (
      select case when b.pl->'product'->>'type' = 'grouped'
                   and jsonb_array_length(coalesce(b.pl->'product'->'items','[]'::jsonb)) > 0
                  then null else b.codigo_principal end as cod
      union all
      select case when b.pl->'product'->>'type' = 'grouped'
                   and jsonb_array_length(coalesce(b.pl->'product'->'items','[]'::jsonb)) > 0
                  then null else b.pl->'product'->>'code' end
      union all select x->>'code' from jsonb_array_elements(coalesce(b.pl->'product'->'items','[]'::jsonb)) x
       where b.pl->'product'->>'type' = 'grouped'
      union all select bb->'product'->>'code' from jsonb_array_elements(coalesce(b.pl->'order_bumps','[]'::jsonb)) bb
       where coalesce(bb->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(bb->'product'->'items','[]'::jsonb)) = 0
      union all select w->>'code' from jsonb_array_elements(coalesce(b.pl->'order_bumps','[]'::jsonb)) bb,
             jsonb_array_elements(coalesce(bb->'product'->'items','[]'::jsonb)) w
       where bb->'product'->>'type' = 'grouped'
      -- Campos da Kiwify, que antes nem chegavam aqui.
      union all select b.pl->'Product'->>'product_id'
      union all select b.pl->>'product_id'
      union all select b.pl->'Subscription'->'plan'->>'id'
    ) z where z.cod is not null
  )
  select exists (
    select 1 from public.courses co
    where co.id = p_course_id and co.checkout_codes && (select array_agg(cod) from codigos)
  );
$$;

comment on function public.curso_coberto_por_outra_compra(text, uuid, text) is
  'true quando outra compra paga e nao estornada DA MESMA PESSOA cobre este curso. Reconhece Payt (transaction_id) e Kiwify (order_id). O codigo do grupo nao entra — grupo entrega os itens.';

revoke all on function public.curso_coberto_por_outra_compra(text, uuid, text) from public;
grant execute on function public.curso_coberto_por_outra_compra(text, uuid, text) to service_role;
