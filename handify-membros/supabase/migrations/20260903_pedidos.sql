-- Pedidos e clientes — quem pediu o que, para quando, e quanto falta receber.
-- Contexto em .claude/plans/tiers-handify.md (fase 6).
--
-- Tres tabelas: clientes (nome + WhatsApp, reaproveitados entre pedidos),
-- pedidos (status a_fazer -> pronto -> entregue, data de entrega, quanto ja
-- recebeu — sinal e "pago" sao derivados do valor, nao guardados) e itens do
-- pedido (do catalogo ou digitados; o preco fica copiado no item, entao mudar
-- o catalogo depois nao mexe em pedido antigo).
--
-- Mesma regra de "nunca some, so congela": a dona sempre le; criar, editar e
-- apagar exigem membership ativa.

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  whatsapp    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.customers is
  'Clientes da aluna (quem compra dela). Nome unico por aluna, sem diferenciar maiusculas.';

create unique index if not exists customers_user_name_idx
  on public.customers (user_id, lower(name));

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete set null,
  status        text not null default 'a_fazer'
                check (status in ('a_fazer', 'pronto', 'entregue')),
  due_date      date,
  delivered_at  timestamptz,
  paid_amount   numeric not null default 0 check (paid_amount >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.orders is
  'Pedidos da aluna. paid_amount = quanto ja recebeu (0 = a receber, parcial = sinal, >= total = pago).';

create index if not exists orders_user_idx on public.orders (user_id, status, due_date);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  catalog_item_id  uuid references public.catalog_items(id) on delete set null,
  name             text not null,
  quantity         integer not null default 1 check (quantity > 0),
  unit_price       numeric not null default 0 check (unit_price >= 0),
  position         integer not null default 0
);

comment on table public.order_items is
  'Itens de um pedido. name e unit_price ficam copiados: mudar o catalogo depois nao altera pedido antigo.';

create index if not exists order_items_order_idx on public.order_items (order_id, position);

alter table public.customers   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- customers
drop policy if exists "Dona ve seus clientes" on public.customers;
create policy "Dona ve seus clientes" on public.customers
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita clientes" on public.customers;
create policy "Completo edita clientes" on public.customers
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

-- orders
drop policy if exists "Dona ve seus pedidos" on public.orders;
create policy "Dona ve seus pedidos" on public.orders
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita pedidos" on public.orders;
create policy "Completo edita pedidos" on public.orders
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

-- order_items
drop policy if exists "Dona ve itens dos pedidos" on public.order_items;
create policy "Dona ve itens dos pedidos" on public.order_items
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Completo edita itens dos pedidos" on public.order_items;
create policy "Completo edita itens dos pedidos" on public.order_items
  for all to authenticated
  using (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()))
  with check (auth.uid() = user_id and (public.has_active_membership(auth.uid()) or public.is_admin()));

revoke all on public.customers, public.orders, public.order_items from anon;

update public.tools
set coming_soon = false, href = '/ferramentas/pedidos'
where slug = 'pedidos-clientes';
