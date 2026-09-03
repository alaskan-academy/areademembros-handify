-- Handify Completo vira entidade: `memberships`.
-- Contexto, numeros e decisoes em .claude/plans/tiers-handify.md (fase 1).
--
-- Ate aqui o plano era um codigo (`LPGKQ8`/`RB3Y72`) colado nos `checkout_codes`
-- de 23 cursos, para que a compra liberasse todos. Nao havia campo, tabela ou
-- funcao que dissesse "esta aluna tem o plano" — e a barra "Seja Premium" se
-- escondia de qualquer aluna com qualquer curso (30 de 3.387 viam a oferta).

-- ─── 0. Tipo e tabela ────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'membership_source') then
    create type public.membership_source as enum ('payt', 'kiwify', 'manual', 'bonus', 'migration');
  end if;
end $$;

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  plan        text not null default 'completo',
  source      public.membership_source not null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  granted_by  uuid references public.profiles(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

comment on table public.memberships is
  'Quem tem o Handify Completo (plan = completo). Fonte da verdade do tier: uma aluna com os 23 cursos comprados separados NAO e Completo — Completo e quem tem linha ativa aqui. Revogar = marcar revoked_at, nunca apagar (historico).';
comment on column public.memberships.granted_by is 'Admin que deu na mao. Null quando veio de webhook/backfill.';
comment on column public.memberships.reason is 'Motivo: obrigatorio no manual/bonus; automatico no webhook.';

-- Uma membership ativa por plano por aluna; o historico fica em linhas revogadas.
create unique index if not exists memberships_one_active_per_plan
  on public.memberships (user_id, plan) where revoked_at is null;
create index if not exists memberships_user_id_idx on public.memberships (user_id);

alter table public.memberships enable row level security;

drop policy if exists "Ver própria membership" on public.memberships;
create policy "Ver própria membership" on public.memberships
  for select using (auth.uid() = user_id);

drop policy if exists "Admin gerencia memberships" on public.memberships;
create policy "Admin gerencia memberships" on public.memberships
  for all using (public.is_admin());

-- ─── 1. Leitura: espelho SQL do que `access.ts` faz em TS ────────────────────
create or replace function public.has_active_membership(p_user_id uuid, p_plan text default 'completo')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where user_id = p_user_id
      and plan = p_plan
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

-- O tier nunca e armazenado — e derivado. `getTier()` em access.ts deve concordar.
create or replace function public.current_tier()
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then 'visitante'
    when public.is_admin() then 'admin'
    when public.has_active_membership(auth.uid()) then 'completo'
    when exists (
      select 1 from public.enrollments
      where user_id = auth.uid() and (expires_at is null or expires_at > now())
    ) then 'aluna'
    else 'visitante'
  end;
$$;

create or replace function public.is_plan_code(p_code text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.annual_promo a, unnest(a.subscription_product_codes) c
    where lower(c) = lower(p_code)
  );
$$;

-- ─── 2. Membership a partir dos pagamentos ───────────────────────────────────
-- Uma implementacao para os cinco caminhos de ativacao de conta que existem: a
-- conta nasce, `handle_new_user` chama `process_pending_payment_events`, que
-- chama isto. Tambem e o backfill (item 4).
create or replace function public.sync_membership_from_payments(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_email  text;
  v_compra record;
begin
  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then return false; end if;
  if public.has_active_membership(p_user_id) then return false; end if;

  -- Primeira compra paga do plano que nao foi desfeita por reembolso depois.
  select pe.created_at, pe.platform into v_compra
  from public.payment_events pe
  where lower(pe.buyer_email) = lower(v_email)
    and pe.event_type in ('paid', 'approved', 'completed', 'confirmed', 'order_approved', 'subscription_renewed')
    and public.is_plan_code(pe.product_code)
    and not exists (
      select 1 from public.payment_events r
      where lower(r.buyer_email) = lower(v_email)
        and public.is_plan_code(r.product_code)
        and r.event_type in ('refunded', 'order_refunded', 'chargeback', 'canceled', 'cancelled',
                             'subscription_canceled', 'subscription_late')
        and r.created_at > pe.created_at
    )
  order by pe.created_at
  limit 1;

  if not found then return false; end if;

  insert into public.memberships (user_id, plan, source, granted_at, reason)
  values (
    p_user_id,
    'completo',
    case when lower(coalesce(v_compra.platform, '')) = 'kiwify' then 'kiwify' else 'payt' end::public.membership_source,
    v_compra.created_at,   -- quando ela passou a ter o plano, nao quando constatamos
    'compra do plano em payment_events'
  );
  return true;
end;
$$;

-- ─── 3. process_pending_payment_events: conserto + gancho ────────────────────
-- Regressao: a funcao ainda citava `c.product_codes`, coluna renomeada para
-- `checkout_codes` em 03/09. Falhava em toda conta nova, com o erro engolido por
-- `raise warning` em handle_new_user. Reescrita igual, so que na coluna certa —
-- e chamando a sync de membership no fim.
create or replace function public.process_pending_payment_events(p_email text)
returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_event   record;
  v_course  record;
  v_user_id uuid;
  v_liberou boolean;
begin
  select id into v_user_id
  from public.profiles
  where lower(email) = lower(p_email)
  limit 1;

  if v_user_id is null then return; end if;

  for v_event in
    select id, product_code, platform
    from public.payment_events
    where lower(buyer_email) = lower(p_email)
      and processed = false
      and error is null
      -- So pagamento efetivamente aprovado libera acesso.
      and event_type in (
        'paid', 'approved', 'completed', 'confirmed',   -- Payt
        'order_approved', 'subscription_renewed'        -- Kiwify
      )
  loop
    v_liberou := false;

    -- Um evento pode liberar mais de um curso (combo/agrupado).
    for v_course in
      select c.id, c.access_days
      from public.courses c
      where lower(v_event.product_code) = any (
        select lower(code) from unnest(c.checkout_codes) as code
      )
    loop
      insert into public.enrollments (user_id, course_id, source, granted_at, expires_at)
      values (
        v_user_id,
        v_course.id,
        coalesce(nullif(v_event.platform, ''), 'payt')::enrollment_source,
        now(),
        case when v_course.access_days is null then null
             else now() + (v_course.access_days || ' days')::interval end
      )
      on conflict (user_id, course_id) do nothing;

      v_liberou := true;
    end loop;

    if v_liberou then
      update public.payment_events set processed = true where id = v_event.id;
    end if;
  end loop;

  -- Compra do plano feita antes da conta existir vira membership aqui.
  perform public.sync_membership_from_payments(v_user_id);
end;
$$;

-- ─── Permissoes: nada disso e para anon ──────────────────────────────────────
revoke execute on function public.has_active_membership(uuid, text) from public, anon;
revoke execute on function public.current_tier() from public, anon;
revoke execute on function public.is_plan_code(text) from public, anon;
revoke execute on function public.sync_membership_from_payments(uuid) from public, anon, authenticated;
grant execute on function public.has_active_membership(uuid, text) to authenticated, service_role;
grant execute on function public.current_tier() to authenticated, service_role;
grant execute on function public.is_plan_code(text) to authenticated, service_role;
grant execute on function public.sync_membership_from_payments(uuid) to service_role;

-- ─── 4. Backfill: as 58 que compraram o plano ────────────────────────────────
-- Idempotente: a sync devolve false para quem ja tem membership ativa.
select public.sync_membership_from_payments(pr.id)
from public.profiles pr
where lower(pr.email) in (
  select lower(pe.buyer_email)
  from public.payment_events pe
  where public.is_plan_code(pe.product_code)
);
