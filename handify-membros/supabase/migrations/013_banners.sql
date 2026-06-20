create table if not exists public.banners (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  image_url      text        not null,
  link_url       text        not null,
  product_codes  text[]      not null default '{}',
  position_slot  text        not null check (position_slot in ('header', 'lateral', 'pos-aula')),
  starts_at      timestamptz,
  ends_at        timestamptz,
  active         boolean     not null default true,
  created_at     timestamptz not null default now()
);

alter table public.banners enable row level security;

-- Alunos/visitantes podem ler banners ativos (filtro de matrícula feito na app)
drop policy if exists "Banners visíveis" on public.banners;
create policy "Banners visíveis" on public.banners
  for select
  using (active = true);

-- Admin tem controle total (inclui leitura de banners inativos)
drop policy if exists "Admin gerencia banners" on public.banners;
create policy "Admin gerencia banners" on public.banners
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
