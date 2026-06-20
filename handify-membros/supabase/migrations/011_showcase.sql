-- URL de checkout (Payt) por curso
alter table public.courses
  add column if not exists checkout_url text;

-- Vitrine pública — cursos selecionados pelo admin
create table if not exists public.showcase_courses (
  course_id            uuid primary key references public.courses(id) on delete cascade,
  sales_video_panda_id text,
  position             int  not null default 0,
  active               boolean not null default true
);

alter table public.showcase_courses enable row level security;

-- Qualquer pessoa pode ler cursos ativos da vitrine
create policy "Vitrine pública"
  on public.showcase_courses for select
  using (active = true);

-- Apenas admin pode gerenciar
create policy "Admin gerencia vitrine"
  on public.showcase_courses for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
