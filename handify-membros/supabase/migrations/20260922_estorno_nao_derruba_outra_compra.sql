-- ─── Estorno de UMA compra não pode derrubar o que OUTRA compra pagou ────────
--
-- Isadora comprou o curso Fábrica das Velas por R$93,45 às 19:12 e o Handify
-- Completo por R$317,97 dez minutos depois. Pediu reembolso só do Completo — e
-- ficou com ZERO cursos, porque o código do plano (LPGKQ8) está cadastrado nos
-- 23 cursos, e a revogação derrubou todos sem perguntar se algum deles estava
-- pago por outra compra.
--
-- Não foi só ela. A varredura de 22/09/2026 achou três:
--
--   Isadora Funchal   — 1 curso  (Fábrica das Velas, R$93,45)
--   Amilton Alavarce  — 2 cursos (Fábrica das Velas R$114,30 + Saponaria R$67)
--   Carla Januario    — 23 cursos + o plano: comprou o Completo DUAS vezes por
--                       engano, pediu reembolso de uma, e perdeu o acesso
--                       inteiro — R$480,39 pagos e válidos, nada liberado.
--
-- A regra de 09/09 ("a pergunta é sobre a transação, não sobre a compradora")
-- consertou a decisão de REVOGAR OU NÃO. Faltava a outra metade: decidido que
-- revoga, *o quê* exatamente revogar. Um curso pago duas vezes só perde o
-- acesso quando as duas compras caem.
create or replace function public.curso_coberto_por_outra_compra(
  p_email       text,
  p_course_id   uuid,
  p_transacao   text
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
        where pe.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
           or (pe.payload->'transaction'->>'payment_status' is null
               and pe.event_type in ('refunded','order_refunded','chargeback','chargedback'))
      ) as estorno_em,
      (array_agg(pe.payload order by pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ))[1] as pl
    from public.payment_events pe
    where lower(pe.buyer_email) = lower(p_email)
      and pe.payload->>'transaction_id' is not null
      -- a transação que está sendo estornada agora não conta a favor dela mesma
      and pe.payload->>'transaction_id' <> p_transacao
      and coalesce((pe.payload->>'test')::boolean, false) = false
    group by 1
  ),
  -- só compra que foi paga e cujo dinheiro não voltou
  boas as (
    select * from tx where pago_em is not null and estorno_em is null
  ),
  -- espelha extractProductCodes(): produto agrupado entrega os ITENS, nunca o
  -- código do grupo. Usar o código do grupo aqui daria falso positivo e a
  -- revogação deixaria de acontecer quando deveria.
  codigos as (
    select z.cod from boas b cross join lateral (
      select case when b.pl->'product'->>'type' = 'grouped'
                   and jsonb_array_length(coalesce(b.pl->'product'->'items','[]'::jsonb)) > 0
                  then null else b.pl->'product'->>'code' end as cod
      union all
      select x->>'code' from jsonb_array_elements(coalesce(b.pl->'product'->'items','[]'::jsonb)) x
       where b.pl->'product'->>'type' = 'grouped'
      union all
      select bb->'product'->>'code' from jsonb_array_elements(coalesce(b.pl->'order_bumps','[]'::jsonb)) bb
       where coalesce(bb->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(bb->'product'->'items','[]'::jsonb)) = 0
      union all
      select w->>'code' from jsonb_array_elements(coalesce(b.pl->'order_bumps','[]'::jsonb)) bb,
             jsonb_array_elements(coalesce(bb->'product'->'items','[]'::jsonb)) w
       where bb->'product'->>'type' = 'grouped'
    ) z where z.cod is not null
  )
  select exists (
    select 1 from public.courses co
    where co.id = p_course_id
      and co.checkout_codes && (select array_agg(cod) from codigos)
  );
$$;

comment on function public.curso_coberto_por_outra_compra(text, uuid, text) is
  'true quando outra compra paga e não estornada da mesma pessoa cobre este curso. Consultada antes de revogar: estornar uma compra não pode derrubar o que outra pagou.';

revoke all on function public.curso_coberto_por_outra_compra(text, uuid, text) from anon, authenticated;

-- ─── Rede de segurança: alguém pagou e está revogado ─────────────────────────
--
-- A correção acima impede que aconteça de novo pelo webhook. Esta função é para
-- o que escapar — inclusive uma revogação feita à mão por engano.
--
-- Entra no relatório diário de compras sem acesso. Custa uma consulta por dia e
-- teria levantado a Isadora no dia seguinte, em vez de quatro dias depois,
-- quando ela escreveu.
create or replace function public.acesso_revogado_mas_pago(dias int default 90)
returns table (
  email       text,
  nome        text,
  user_id     uuid,
  curso       text,
  course_id   uuid,
  revogado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with tx as (
    select lower(pe.buyer_email) as email, pe.payload->>'transaction_id' as transacao,
      max(pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ) as pago_em,
      max(pe.created_at) filter (
        where pe.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
           or (pe.payload->'transaction'->>'payment_status' is null
               and pe.event_type in ('refunded','order_refunded','chargeback','chargedback'))
      ) as estorno_em,
      (array_agg(pe.payload order by pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ))[1] as pl
    from public.payment_events pe
    where pe.payload->>'transaction_id' is not null
      and coalesce((pe.payload->>'test')::boolean, false) = false
      and pe.created_at > now() - make_interval(days => dias)
    group by 1, 2
  ),
  validas as (select * from tx where pago_em is not null and estorno_em is null),
  cods as (
    select v.email, z.cod from validas v cross join lateral (
      select case when v.pl->'product'->>'type' = 'grouped'
                   and jsonb_array_length(coalesce(v.pl->'product'->'items','[]'::jsonb)) > 0
                  then null else v.pl->'product'->>'code' end as cod
      union all
      select x->>'code' from jsonb_array_elements(coalesce(v.pl->'product'->'items','[]'::jsonb)) x
       where v.pl->'product'->>'type' = 'grouped'
      union all
      select bb->'product'->>'code' from jsonb_array_elements(coalesce(v.pl->'order_bumps','[]'::jsonb)) bb
       where coalesce(bb->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(bb->'product'->'items','[]'::jsonb)) = 0
      union all
      select w->>'code' from jsonb_array_elements(coalesce(v.pl->'order_bumps','[]'::jsonb)) bb,
             jsonb_array_elements(coalesce(bb->'product'->'items','[]'::jsonb)) w
       where bb->'product'->>'type' = 'grouped'
    ) z where z.cod is not null
  )
  select distinct p.email, p.full_name, p.id, co.title, co.id, e.expires_at
  from cods c
  join public.courses co on co.checkout_codes && array[c.cod]
  join public.profiles p on lower(p.email) = c.email and p.role <> 'admin'
  join public.enrollments e on e.user_id = p.id and e.course_id = co.id
   and e.expires_at is not null and e.expires_at <= now()
  order by e.expires_at desc;
$$;

comment on function public.acesso_revogado_mas_pago(int) is
  'Curso revogado que uma compra paga e não estornada ainda cobre. Cada linha é alguém que pagou e está sem acesso.';

revoke all on function public.acesso_revogado_mas_pago(int) from anon, authenticated;
