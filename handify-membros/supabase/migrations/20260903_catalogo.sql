-- Catalogo e tabela de precos (PDF) — a vitrine do Handify Completo.
-- Contexto em .claude/plans/tiers-handify.md (fase 6).
--
-- Duas tabelas: a marca dela (nome, WhatsApp, Instagram — vai no cabecalho do
-- PDF e, depois, em rotulos e orcamentos) e os produtos do catalogo, que podem
-- nascer de uma receita guardada (o custo vem de la; se a receita muda, o
-- catalogo mostra o preco sugerido novo).
--
-- Mesma regra de "nunca some, so congela" de recipes: a dona sempre le (e gera
-- o PDF); criar, editar e apagar exigem membership ativa.

create table if not exists public.business_profile (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  brand_name  text not null default '',
  tagline     text,
  whatsapp    text,
  instagram   text,
  city        text,
  updated_at  timestamptz not null default now()
);

comment on table public.business_profile is
  'A marca da aluna: cabecalho do catalogo em PDF (e, depois, rotulos e orcamentos).';

create table if not exists public.catalog_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  name        text not null,
  description text,
  price       numeric not null default 0,
  active      boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.catalog_items is
  'Produtos do catalogo da aluna. recipe_id liga a receita guardada (custo e preco sugerido). active = entra no PDF.';

create index if not exists catalog_items_user_idx on public.catalog_items (user_id, position, created_at);

alter table public.business_profile enable row level security;
alter table public.catalog_items enable row level security;

drop policy if exists "Dona ve sua marca" on public.business_profile;
create policy "Dona ve sua marca" on public.business_profile
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita a marca" on public.business_profile;
create policy "Completo edita a marca" on public.business_profile
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

drop policy if exists "Dona ve seu catalogo" on public.catalog_items;
create policy "Dona ve seu catalogo" on public.catalog_items
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita o catalogo" on public.catalog_items;
create policy "Completo edita o catalogo" on public.catalog_items
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

revoke all on public.business_profile, public.catalog_items from anon;

update public.tools
set coming_soon = false, href = '/ferramentas/catalogo'
where slug = 'catalogo-precos';
