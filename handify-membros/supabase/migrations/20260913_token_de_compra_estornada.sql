-- ─── Não liberar curso de compra que foi estornada ───────────────────────────
--
-- `grantPendingEnrollments` concede todo activation_token com used=false, sem
-- nunca perguntar se aquele dinheiro continuou na conta. Hoje há 42 tokens
-- pendentes de e-mails que tiveram estorno: se qualquer uma dessas 58 pessoas
-- criar conta, entra com acesso a uma compra reembolsada.
--
-- O buraco é antigo, mas ficou maior em 12/09 quando o cadastro passou a achar
-- a compra também pelo telefone — agora um token estornado alcança inclusive
-- quem se cadastrou com outro e-mail.
--
-- A pergunta é sobre a TRANSAÇÃO, nunca sobre o e-mail. Um "canceled" de uma
-- transação que nunca teve "paid" é PIX abandonado e não significa nada; o que
-- importa é "paid" seguido de estorno na MESMA transação. Confundir os dois foi
-- o que revogou o acesso pago de 24 alunas em 09/09/2026.

-- Os tokens antigos não têm como saber de qual transação vieram. A partir daqui
-- o webhook grava, e a checagem fica exata em vez de conservadora.
alter table public.activation_tokens
  add column if not exists transaction_id text;

comment on column public.activation_tokens.transaction_id is
  'Transação da Payt/Kiwify que gerou este token. Null nos tokens anteriores a 13/09/2026 — nesses, a checagem de estorno olha todas as transações do e-mail.';

create index if not exists activation_tokens_transaction_idx
  on public.activation_tokens (transaction_id)
  where transaction_id is not null;

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
      max(pe.created_at) filter (
        where pe.event_type in ('refunded','chargeback','chargedback','canceled','cancelled','refund_requested','order_refunded')
      ) as estorno_em
    from public.payment_events pe
    where lower(pe.buyer_email) = lower(p_email)
      and pe.payload->>'transaction_id' is not null
      -- Sem transação conhecida, olha TODAS as do e-mail: prefere segurar uma
      -- compra boa a liberar uma estornada. O caso segurado vira linha no
      -- relatório de compras sem acesso e a admin decide.
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
  'true quando a transação foi paga e depois estornada. Sem transaction_id, considera todas as transações do e-mail (conservador).';

revoke all on function public.compra_estornada(text, text) from anon, authenticated;

-- O relatório de compras sem acesso passa a separar o que é seguro liberar do
-- que tem estorno na história. Antes, uma compra reembolsada aparecia para a
-- admin como "aluna pagante sem acesso" — e a correção óbvia seria liberar.
-- A coluna tem_estorno muda o tipo de retorno, e o Postgres não deixa trocar
-- isso com CREATE OR REPLACE.
drop function if exists public.compras_sem_acesso(int);

create or replace function public.compras_sem_acesso(dias_minimos int default 1)
returns table (
  email_da_compra   text,
  email_da_conta    text,
  nome_da_compra    text,
  nome_da_conta     text,
  vinculo           text,
  user_id           uuid,
  curso             text,
  comprado_em       timestamptz,
  tem_estorno       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with tokens as (
    select t.email, t.course_id, t.buyer_name, t.buyer_phone_norm, t.created_at, t.transaction_id
    from public.activation_tokens t
    where not t.used
      and t.course_id is not null
      and t.created_at < now() - make_interval(days => dias_minimos)
  ),
  candidatos as (
    select t.email, p.email as conta_email, t.buyer_name, p.full_name,
           'email'::text as vinculo, p.id as user_id, t.course_id, t.created_at, t.transaction_id
    from tokens t
    join public.profiles p on lower(p.email) = lower(t.email)

    union all

    select t.email, p.email, t.buyer_name, p.full_name,
           'telefone'::text, p.id, t.course_id, t.created_at, t.transaction_id
    from tokens t
    join public.profiles p
      on p.phone_norm = t.buyer_phone_norm
     and length(t.buyer_phone_norm) >= 10
     and p.role <> 'admin'
    where not exists (
      select 1 from public.profiles p2 where lower(p2.email) = lower(t.email)
    )
  )
  select c.email, c.conta_email, c.buyer_name, c.full_name, c.vinculo,
         c.user_id, co.title, c.created_at,
         public.compra_estornada(c.email, c.transaction_id)
  from candidatos c
  join public.courses co on co.id = c.course_id
  where not exists (
    select 1 from public.enrollments e
    where e.user_id = c.user_id
      and e.course_id = c.course_id
      and (e.expires_at is null or e.expires_at > now())
  )
  order by c.created_at;
$$;

comment on function public.compras_sem_acesso(int) is
  'Compras pagas cuja aluna tem conta mas não está matriculada. tem_estorno=true exige conferir na Payt antes de liberar qualquer coisa.';

revoke all on function public.compras_sem_acesso(int) from anon, authenticated;
