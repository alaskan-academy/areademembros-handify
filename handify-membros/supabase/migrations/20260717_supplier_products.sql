-- ── Fornecedores v2 — Nichos + Produtos ─────────────────────────────────────
-- Adiciona suporte a produtos específicos com múltiplos fornecedores por produto
-- e nichos temáticos (Velas, Sabonetes, ...) como dimensão de filtro.
-- Tabelas existentes (suppliers, supplier_channels, etc.) são preservadas.

-- ── Nichos ───────────────────────────────────────────────────────────────────
create table if not exists niches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  active     boolean not null default true,
  position   int     not null default 0,
  created_at timestamptz not null default now()
);

-- ── Fornecedor ↔ Nicho ────────────────────────────────────────────────────────
create table if not exists supplier_niche_links (
  supplier_id uuid not null references suppliers(id) on delete cascade,
  niche_id    uuid not null references niches(id)    on delete cascade,
  primary key (supplier_id, niche_id)
);

-- ── Produtos ─────────────────────────────────────────────────────────────────
-- Um produto é um material específico (ex: "Cera de carnaúba 1kg")
create table if not exists products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  image_url  text,
  active     boolean not null default true,
  position   int     not null default 0,
  created_at timestamptz not null default now()
);

-- ── Produto ↔ Nicho ───────────────────────────────────────────────────────────
create table if not exists product_niche_links (
  product_id uuid not null references products(id) on delete cascade,
  niche_id   uuid not null references niches(id)   on delete cascade,
  primary key (product_id, niche_id)
);

-- ── Produto ↔ Fornecedor (com link de compra) ─────────────────────────────────
-- Um produto pode ser vendido por múltiplos fornecedores,
-- cada um com seu próprio link direto ao produto.
create table if not exists product_supplier_links (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id)  on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  buy_url     text not null,
  position    int  not null default 0,
  unique (product_id, supplier_id)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
create index if not exists idx_niches_active_position
  on niches (active, position);

create index if not exists idx_supplier_niche_links_supplier
  on supplier_niche_links (supplier_id);

create index if not exists idx_supplier_niche_links_niche
  on supplier_niche_links (niche_id);

create index if not exists idx_products_active_position
  on products (active, position);

create index if not exists idx_product_niche_links_product
  on product_niche_links (product_id);

create index if not exists idx_product_niche_links_niche
  on product_niche_links (niche_id);

create index if not exists idx_product_supplier_links_product
  on product_supplier_links (product_id, position);

create index if not exists idx_product_supplier_links_supplier
  on product_supplier_links (supplier_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table niches                enable row level security;
alter table supplier_niche_links  enable row level security;
alter table products              enable row level security;
alter table product_niche_links   enable row level security;
alter table product_supplier_links enable row level security;

-- niches — alunas veem ativos; admin gerencia
create policy "Alunas veem nichos ativos"
  on niches for select
  using (active = true and auth.role() = 'authenticated');

create policy "Admins gerenciam nichos"
  on niches for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- supplier_niche_links — leitura livre para autenticados; escrita admin
create policy "Alunas veem vínculos fornecedor-nicho"
  on supplier_niche_links for select
  using (auth.role() = 'authenticated');

create policy "Admins gerenciam vínculos fornecedor-nicho"
  on supplier_niche_links for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- products — alunas veem ativos; admin gerencia
create policy "Alunas veem produtos ativos"
  on products for select
  using (active = true and auth.role() = 'authenticated');

create policy "Admins gerenciam produtos"
  on products for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- product_niche_links — leitura livre para autenticados; escrita admin
create policy "Alunas veem vínculos produto-nicho"
  on product_niche_links for select
  using (auth.role() = 'authenticated');

create policy "Admins gerenciam vínculos produto-nicho"
  on product_niche_links for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- product_supplier_links — leitura livre para autenticados; escrita admin
create policy "Alunas veem links de compra"
  on product_supplier_links for select
  using (auth.role() = 'authenticated');

create policy "Admins gerenciam links de compra"
  on product_supplier_links for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ── Dados iniciais — Nichos ───────────────────────────────────────────────────
insert into niches (name, slug, position) values
  ('Velas', 'velas', 1),
  ('Saboaria', 'saboaria', 2),
  ('Aromaterapia', 'aromaterapia', 3),
  ('Embalagens', 'embalagens', 4)
on conflict (slug) do nothing;
