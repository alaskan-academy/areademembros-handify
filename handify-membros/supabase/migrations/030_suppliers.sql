-- ── Fornecedores ────────────────────────────────────────────────────────────
-- Tabela principal de fornecedores
create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  logo_url    text,
  verified    boolean not null default false,  -- "Verificado Handify"
  active      boolean not null default true,
  position    int     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Canais de compra (website / instagram / shopee / mercadolivre)
create table if not exists supplier_channels (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  channel     text not null check (channel in ('website','instagram','shopee','mercadolivre')),
  url         text not null,
  unique (supplier_id, channel)
);

-- Tags: produto alvo (velas, sabonetes) e categoria do que fornecem
-- Ex: tag = 'velas', 'essencias', 'ceras', 'pavios', 'moldes', ...
create table if not exists supplier_tags (
  supplier_id uuid not null references suppliers(id) on delete cascade,
  tag         text not null,
  primary key (supplier_id, tag)
);

-- Favoritos das alunas
create table if not exists supplier_favorites (
  user_id     uuid not null references profiles(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, supplier_id)
);

-- Comentários/avaliações das alunas (com moderação admin)
create table if not exists supplier_reviews (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 10 and 1000),
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (supplier_id, user_id)   -- uma avaliação por aluna por fornecedor
);

-- Sugestões de novos fornecedores enviadas pelas alunas
create table if not exists supplier_suggestions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  url           text,
  what_they_sell text,
  notes         text,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  admin_notes   text,
  created_at    timestamptz not null default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists idx_suppliers_active_position
  on suppliers (active, position);

create index if not exists idx_supplier_tags_tag
  on supplier_tags (tag);

create index if not exists idx_supplier_channels_supplier
  on supplier_channels (supplier_id);

create index if not exists idx_supplier_reviews_supplier_approved
  on supplier_reviews (supplier_id, approved);

create index if not exists idx_supplier_suggestions_status
  on supplier_suggestions (status, created_at desc);

-- ── Trigger updated_at ───────────────────────────────────────────────────────
create or replace function touch_suppliers_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger suppliers_updated_at
  before update on suppliers
  for each row execute function touch_suppliers_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table suppliers           enable row level security;
alter table supplier_channels   enable row level security;
alter table supplier_tags       enable row level security;
alter table supplier_favorites  enable row level security;
alter table supplier_reviews    enable row level security;
alter table supplier_suggestions enable row level security;

-- suppliers — alunas leem ativos; admin gerencia tudo
create policy "Alunas veem fornecedores ativos"
  on suppliers for select
  using (active = true and auth.role() = 'authenticated');

create policy "Admins gerenciam fornecedores"
  on suppliers for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- supplier_channels — mesma visibilidade do supplier pai
create policy "Alunas veem canais de fornecedores ativos"
  on supplier_channels for select
  using (
    exists (select 1 from suppliers where id = supplier_id and active = true)
    and auth.role() = 'authenticated'
  );

create policy "Admins gerenciam canais"
  on supplier_channels for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- supplier_tags — mesma visibilidade do supplier pai
create policy "Alunas veem tags de fornecedores ativos"
  on supplier_tags for select
  using (
    exists (select 1 from suppliers where id = supplier_id and active = true)
    and auth.role() = 'authenticated'
  );

create policy "Admins gerenciam tags"
  on supplier_tags for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- supplier_favorites — cada aluna gerencia os próprios
create policy "Alunas gerenciam próprios favoritos"
  on supplier_favorites for all
  using (user_id = auth.uid());

-- supplier_reviews — alunas veem aprovados; inserem os próprios; admin gerencia tudo
create policy "Alunas veem comentários aprovados"
  on supplier_reviews for select
  using (approved = true and auth.role() = 'authenticated');

create policy "Alunas inserem próprio comentário"
  on supplier_reviews for insert
  with check (user_id = auth.uid() and auth.role() = 'authenticated');

create policy "Alunas atualizam próprio comentário"
  on supplier_reviews for update
  using (user_id = auth.uid() and not approved);

create policy "Admins gerenciam comentários"
  on supplier_reviews for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- supplier_suggestions — alunas inserem e veem as próprias; admin vê todas
create policy "Alunas inserem sugestões"
  on supplier_suggestions for insert
  with check (user_id = auth.uid() and auth.role() = 'authenticated');

create policy "Alunas veem próprias sugestões"
  on supplier_suggestions for select
  using (user_id = auth.uid());

create policy "Admins gerenciam sugestões"
  on supplier_suggestions for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
