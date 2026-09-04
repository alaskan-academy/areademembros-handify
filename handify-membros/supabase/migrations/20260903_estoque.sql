-- Estoque de insumos — quanto tem de cada material, o que esta acabando e o
-- que vence. Contexto em .claude/plans/tiers-handify.md (fase 6).
--
-- Uma tabela so: nome, categoria, quantidade + unidade, minimo (abaixo dele
-- "acabando"), validade da embalagem (alimenta a ferramenta de Validade),
-- quanto pagou por quanto (custo por unidade derivado), fornecedor, notas.
--
-- Mesma regra de "nunca some, so congela": a dona sempre le; criar, editar e
-- apagar exigem membership ativa.

create table if not exists public.supplies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  category       text not null default 'outros'
                 check (category in ('cera', 'base', 'oleo', 'essencia', 'corante', 'aditivo', 'embalagem', 'pavio', 'outros')),
  quantity       numeric not null default 0 check (quantity >= 0),
  unit           text not null default 'g' check (unit in ('g', 'kg', 'mL', 'L', 'un')),
  min_quantity   numeric check (min_quantity >= 0),
  expires_at     date,
  cost           numeric check (cost >= 0),
  cost_quantity  numeric check (cost_quantity > 0),
  supplier       text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.supplies is
  'Insumos da aluna. min_quantity = abaixo disso esta acabando; expires_at = validade da embalagem; cost por cost_quantity = ultimo preco pago.';

create index if not exists supplies_user_idx on public.supplies (user_id, category, name);

alter table public.supplies enable row level security;

drop policy if exists "Dona ve seu estoque" on public.supplies;
create policy "Dona ve seu estoque" on public.supplies
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita o estoque" on public.supplies;
create policy "Completo edita o estoque" on public.supplies
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

revoke all on public.supplies from anon;

update public.tools
set coming_soon = false, href = '/ferramentas/estoque'
where slug = 'estoque';
