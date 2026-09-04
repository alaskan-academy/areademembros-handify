-- Calendario do artesanato — as datas que vendem (calculadas no codigo) e as
-- datas dela (feira, encomenda grande), com prazo de producao e cura.
-- Contexto em .claude/plans/tiers-handify.md (fase 6).
-- Mesma regra de "nunca some, so congela": a dona sempre le; escrever exige
-- membership ativa.

create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  date        date not null,
  notes       text,
  created_at  timestamptz not null default now()
);

comment on table public.calendar_events is
  'Datas da aluna no Calendario do artesanato (feira, encomenda grande). As datas comerciais sao calculadas no codigo.';

create index if not exists calendar_events_user_idx on public.calendar_events (user_id, date);

alter table public.calendar_events enable row level security;

drop policy if exists "Dona ve suas datas" on public.calendar_events;
create policy "Dona ve suas datas" on public.calendar_events
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita suas datas" on public.calendar_events;
create policy "Completo edita suas datas" on public.calendar_events
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

revoke all on public.calendar_events from anon;

update public.tools
set coming_soon = false, href = '/ferramentas/calendario'
where slug = 'calendario';
