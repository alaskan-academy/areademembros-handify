-- Minhas receitas: a ficha de "Minha receita" guardada na conta.
-- Primeira ferramenta "Guardar", exclusiva do Handify Completo.
-- Contexto em .claude/plans/tiers-handify.md (fases 3 e 6).
--
-- Regra "nunca some, so congela": quem teve o plano e deixou vencer continua
-- VENDO (e exportando) o que e dela — so nao cria nem edita ate renovar. E o
-- tipo de dependencia que a aluna aceita: renova para continuar trabalhando,
-- nao para reaver o que ja era dela. Por isso o SELECT e da dona sempre, e
-- INSERT/UPDATE/DELETE exigem membership ativa.

create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  product        text not null check (product in ('sabonetes', 'velas')),
  -- Resumo para listar e para o catalogo (fase seguinte) sem abrir o json.
  units          int not null default 0,
  unit_weight    numeric,
  cost_per_unit  numeric,
  price          numeric,
  margin         int,
  aroma          text,
  wick           text,
  -- O formulario inteiro, como ela deixou (reabre no fluxo do jeito que estava).
  data           jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.recipes is
  'Receitas guardadas na conta (Minha receita → Guardar na conta). Dona sempre le; escrever exige Handify Completo ativo — plano vencido congela, nao apaga.';

create index if not exists recipes_user_updated_idx on public.recipes (user_id, updated_at desc);

alter table public.recipes enable row level security;

drop policy if exists "Dona ve suas receitas" on public.recipes;
create policy "Dona ve suas receitas" on public.recipes
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Completo cria receitas" on public.recipes;
create policy "Completo cria receitas" on public.recipes
  for insert to authenticated
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

drop policy if exists "Completo edita receitas" on public.recipes;
create policy "Completo edita receitas" on public.recipes
  for update to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

drop policy if exists "Completo apaga receitas" on public.recipes;
create policy "Completo apaga receitas" on public.recipes
  for delete to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

revoke all on public.recipes from anon;

-- A ferramenta sai do "em breve".
update public.tools
set coming_soon = false, href = '/ferramentas/minhas-receitas'
where slug = 'minhas-receitas';
