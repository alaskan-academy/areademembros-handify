-- ─── A matrícula retroativa não pode desfazer decisão da admin ─────────────
--
-- ESTE ARQUIVO ESTAVA FALTANDO. A mudança abaixo foi aplicada direto em
-- produção em 22/09/2026 (migration `20260922_retroativa_respeita_revogacao_manual`)
-- e nunca virou arquivo. Resultado: `20260922_matricula_retroativa_correta.sql`
-- ficou com a versão ANTERIOR da função, e reconstruir o banco a partir do
-- repositório perderia a guarda — o botão de acesso retroativo voltaria a
-- devolver curso que a Jessica tirou de propósito.
--
-- Achado em 24/09 ao cruzar `supabase_migrations.schema_migrations` com os
-- arquivos da pasta. É a mesma família do achado "o banco não pode ser
-- recriado a partir do código" da auditoria de 02/09.
--
-- ── O que a guarda faz ─────────────────────────────────────────────────────
--
-- Rodando a função nova contra os 24 cursos, ela devolvia kate.sarto@gmail.com
-- em 5 cursos — justamente os 5 que a Jessica revogou a mão em 17/09/2026, com
-- o motivo "queria velas de lembrancinha". Um clique no botão desfaria a
-- decisão dela, em silêncio.
--
-- A função não tinha como saber: a revogação antiga APAGAVA a linha de
-- `enrollments`, então não sobra nada para o `not exists` enxergar. O que sobra
-- é o `audit_log`. (A partir do D20 a revogação expira em vez de apagar, e aí o
-- `not exists` já basta — esta guarda é para o passivo antigo e para quem
-- apagar por outro caminho.)
--
-- Depois dela, a função devolve 1 aluna em vez de 6: a que realmente pagou,
-- nunca teve acesso e nunca foi revogada.

create or replace function public.alunas_para_matricula_retroativa(
  p_course_id uuid,
  p_limite integer default 500
)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with pagas as (
    select
      pe.payload as pl,
      lower(pe.buyer_email) as em,
      pe.created_at as pago_em,
      coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') as tx
    from public.payment_events pe
    where pe.event_type in (
            'paid','approved','completed','confirmed','order_approved','subscription_renewed'
          )
      and coalesce((pe.payload->>'test')::boolean, false) = false
      and pe.buyer_email is not null
  ),
  nao_estornadas as (
    select p.*
    from pagas p
    where not exists (
      select 1
      from public.payment_events est
      where coalesce(est.payload->>'transaction_id', est.payload->>'order_id') = p.tx
        and est.created_at > p.pago_em
        and (
          est.payload->'transaction'->>'payment_status'
            in ('refunded','chargeback','canceled','cancelled')
          or (est.payload->'transaction'->>'payment_status' is null
              and est.event_type in (
                    'refunded','order_refunded','chargeback','chargedback',
                    'canceled','cancelled',
                    'subscription_canceled','subscription_late'
                  ))
        )
    )
  ),
  codigos as (
    select p.em, z.cod
    from nao_estornadas p
    cross join lateral (
      select case
               when p.pl->'product'->>'type' = 'grouped'
                and jsonb_array_length(coalesce(p.pl->'product'->'items','[]'::jsonb)) > 0
               then null
               else p.pl->'product'->>'code'
             end as cod
      union all
      select x->>'code'
        from jsonb_array_elements(coalesce(p.pl->'product'->'items','[]'::jsonb)) x
       where p.pl->'product'->>'type' = 'grouped'
      union all
      select b->'product'->>'code'
        from jsonb_array_elements(coalesce(p.pl->'order_bumps','[]'::jsonb)) b
       where coalesce(b->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(b->'product'->'items','[]'::jsonb)) = 0
      union all
      select w->>'code'
        from jsonb_array_elements(coalesce(p.pl->'order_bumps','[]'::jsonb)) b,
             jsonb_array_elements(coalesce(b->'product'->'items','[]'::jsonb)) w
       where b->'product'->>'type' = 'grouped'
      union all
      select p.pl->'Product'->>'product_id'
      union all
      select p.pl->>'product_id'
      union all
      select p.pl->'Subscription'->'plan'->>'id'
    ) z
    where z.cod is not null
  ),
  compradoras as (
    select distinct k.em
    from codigos k
    join public.courses c on c.id = p_course_id
    where exists (
            select 1 from unnest(c.checkout_codes) cc where lower(cc) = lower(k.cod)
          )
       or (public.is_plan_code(k.cod) and c.in_plan)
  )
  select pr.id, pr.email
  from compradoras cm
  join public.profiles pr on lower(pr.email) = cm.em
  where pr.role <> 'admin'
    and pr.banned = false
    and not exists (
      select 1
      from public.enrollments e
      where e.user_id = pr.id
        and e.course_id = p_course_id
        and (e.expires_at is null or e.expires_at > now())
    )
    -- A GUARDA QUE ESTE ARQUIVO EXISTE PARA REGISTRAR:
    -- quem a admin revogou à mão não volta pelo botão.
    and not exists (
      select 1
      from public.audit_log a
      where a.action in ('revoke_access','revoke_course','remove_enrollment')
        and (a.meta->>'user_id')::uuid = pr.id
        and (a.meta->>'course_id')::uuid = p_course_id
    )
  order by pr.id
  limit p_limite;
$$;

comment on function public.alunas_para_matricula_retroativa(uuid, integer) is
  'Alunas com compra paga e nao estornada deste curso e sem matricula ativa. Extracao de codigos igual a do webhook; estorno so conta quando vem depois do pagamento; admin e banida ficam de fora; e quem a admin revogou a mao NAO volta.';

revoke all on function public.alunas_para_matricula_retroativa(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.alunas_para_matricula_retroativa(uuid, integer)
  to service_role;
