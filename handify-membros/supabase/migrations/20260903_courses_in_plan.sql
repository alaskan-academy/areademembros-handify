-- Curso entra no Handify Completo por uma flag, nao por codigo colado.
-- Contexto em .claude/plans/tiers-handify.md (fase 3).
--
-- Ate aqui "fazer parte do plano" era ter o codigo do plano (LPGKQ8/RB3Y72)
-- dentro dos checkout_codes do curso — um curso novo so entrava no plano se
-- alguem lembrasse de colar o codigo. `is_subscription_only` existia para isso
-- e nenhum curso usava. Vira `in_plan`, com o significado que o nome diz.

alter table public.courses rename column is_subscription_only to in_plan;

comment on column public.courses.in_plan is
  'Faz parte do Handify Completo. Quem tem membership ativa acessa (is_enrolled / hasCourseAccess), ganha a matricula na compra do plano e no primeiro acesso. Substitui colar o codigo do plano nos checkout_codes de cada curso.';

-- Backfill: os cursos que hoje carregam o codigo do plano nos checkout_codes.
update public.courses c
set in_plan = true
from public.annual_promo a
where c.checkout_codes && a.subscription_product_codes;

-- ─── Acesso: matricula OU (membership ativa e curso no plano) ────────────────
-- Curso novo marcado in_plan fica acessivel na hora para quem tem o plano, sem
-- backfill de matriculas. O TS (hasCourseAccess) faz o mesmo e ainda cria a
-- matricula no primeiro acesso — progresso e certificado saem dela.
create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or exists (
        select 1 from public.enrollments
        where user_id = auth.uid()
          and course_id = p_course_id
          and (expires_at is null or expires_at > now())
      )
      or (
        public.has_active_membership(auth.uid())
        and exists (select 1 from public.courses where id = p_course_id and in_plan)
      );
$$;

-- ─── Compra do plano antes da conta existir: matricula em todos os in_plan ───
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
      and event_type in (
        'paid', 'approved', 'completed', 'confirmed',
        'order_approved', 'subscription_renewed'
      )
  loop
    v_liberou := false;

    -- Cursos com o codigo comprado (combo/agrupado libera mais de um), mais —
    -- se o codigo e do plano — todos os cursos marcados in_plan, inclusive os
    -- que nao carregam o codigo do plano nos checkout_codes (cursos novos).
    for v_course in
      select c.id, c.access_days
      from public.courses c
      where lower(v_event.product_code) = any (
              select lower(code) from unnest(c.checkout_codes) as code
            )
         or (public.is_plan_code(v_event.product_code) and c.in_plan)
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

  perform public.sync_membership_from_payments(v_user_id);
end;
$$;
