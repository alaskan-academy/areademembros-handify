-- HANDIFY AREA DE MEMBROS — SETUP COMPLETO
-- Aplicar no SQL Editor: https://supabase.com/dashboard/project/ozsbyscxcpijyvnjlkpw/sql/new

-- ExtensÃµes necessÃ¡rias
create extension if not exists "pgcrypto";   -- criptografia de CPF
create extension if not exists "pg_trgm";    -- busca full-text em portuguÃªs
create extension if not exists "uuid-ossp";  -- geraÃ§Ã£o de UUIDs


-- ============================================================
-- RESET TOTAL â€” drop tudo no schema public
-- ============================================================
do $$
declare
  r record;
begin
  for r in (
    select tablename from pg_tables where schemaname = 'public'
  ) loop
    execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
  end loop;
end $$;

-- Drop tipos antigos se existirem
drop type if exists public.role_type cascade;
drop type if exists public.enrollment_source cascade;
drop type if exists public.content_block_type cascade;
drop type if exists public.banner_slot cascade;
drop type if exists public.menu_visibility cascade;
drop type if exists public.notification_type cascade;
drop type if exists public.report_target_type cascade;
drop type if exists public.audit_action cascade;

-- Drop funÃ§Ãµes antigas se existirem
drop function if exists public.is_admin() cascade;
drop function if exists public.is_enrolled(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.process_pending_payment_events(text) cascade;
drop function if exists public.notify_on_news_post() cascade;
drop function if exists public.notify_on_comment_reply() cascade;
drop function if exists public.notify_on_new_lesson() cascade;

-- ============================================================
-- INÃCIO DO NOVO SCHEMA
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
create type public.role_type as enum ('student', 'admin');
create type public.enrollment_source as enum ('payt', 'manual', 'subscription');
create type public.content_block_type as enum ('text', 'html', 'embed', 'download');
create type public.banner_slot as enum ('header', 'sidebar', 'post-lesson');
create type public.menu_visibility as enum ('guest', 'student', 'admin');
create type public.notification_type as enum (
  'news_post', 'comment_reply', 'new_lesson', 'course_complete', 'certificate_ready'
);
create type public.report_target_type as enum (
  'forum_post', 'forum_comment', 'news_comment', 'lesson_comment'
);
create type public.audit_action as enum (
  'grant_access', 'revoke_access', 'ban_user', 'unban_user',
  'delete_post', 'delete_comment', 'webhook_processed', 'webhook_failed'
);

-- ============================================================
-- USUÃRIOS
-- ============================================================
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  cpf_encrypted  text,                        -- AES-256 via pgcrypto na app
  avatar_url     text,
  bio            text,
  role           public.role_type not null default 'student',
  banned         boolean not null default false,
  email_prefs    jsonb not null default '{
    "news_post": true,
    "comment_reply": true,
    "new_lesson": true,
    "course_complete": true,
    "certificate_ready": true
  }'::jsonb,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- CATÃLOGO
-- ============================================================
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table public.courses (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  title                text not null,
  description          text not null default '',
  thumbnail_url        text,
  category_id          uuid references public.categories(id) on delete set null,
  price                numeric(10,2) not null default 0,
  product_code         text not null unique,   -- chave Payt para liberar acesso
  workload_hours       numeric(5,1) not null default 0,
  is_subscription_only boolean not null default false,
  published            boolean not null default false,
  position             integer not null default 0,
  created_at           timestamptz not null default now()
);

create table public.modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  title      text not null,
  position   integer not null default 0
);

create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.modules(id) on delete cascade,
  title            text not null,
  video_panda_id   text,
  duration_seconds integer not null default 0,
  is_preview       boolean not null default false,  -- acessÃ­vel sem matrÃ­cula
  position         integer not null default 0
);

create table public.lesson_content_blocks (
  id        uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type      public.content_block_type not null,
  content   text not null default '',
  position  integer not null default 0
);

create table public.lesson_materials (
  id        uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name      text not null,
  file_path text not null     -- caminho no Supabase Storage (bucket privado)
);

-- ============================================================
-- VITRINE
-- ============================================================
create table public.showcase_courses (
  course_id           uuid primary key references public.courses(id) on delete cascade,
  sales_video_panda_id text,   -- ID do vÃ­deo de vendas (mini PV) â€” diferente do vÃ­deo de aula
  position            integer not null default 0,
  active              boolean not null default true
);

-- ============================================================
-- BANNERS CONDICIONAIS
-- ============================================================
create table public.banners (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,                          -- nome interno
  image_url     text not null,
  link_url      text not null,
  product_codes text[] not null default '{}',           -- banners exibidos a quem NÃƒO tem esses product_codes
  position_slot public.banner_slot not null default 'header',
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- MENU EDITÃVEL
-- ============================================================
create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  url         text not null,
  icon        text,
  target      text not null default '_self' check (target in ('_self', '_blank')),
  visible_to  public.menu_visibility not null default 'student',
  position    integer not null default 0,
  parent_id   uuid references public.menu_items(id) on delete set null
);

-- ============================================================
-- PÃGINAS ESTÃTICAS
-- ============================================================
create table public.static_pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  blocks     jsonb not null default '[]'::jsonb,  -- array de content blocks
  published  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ACESSO E PROGRESSO
-- ============================================================
create table public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  source     public.enrollment_source not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, course_id)
);

create table public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  completed     boolean not null default false,
  last_position integer not null default 0,  -- segundos
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table public.certificates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  verify_hash text not null unique default gen_random_uuid()::text,  -- UUID v4 para QR code
  issued_at   timestamptz not null default now(),
  pdf_path    text not null,   -- caminho no Supabase Storage (bucket privado)
  unique (user_id, course_id)
);

-- ============================================================
-- PAGAMENTOS (log raw de webhooks)
-- ============================================================
create table public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null default 'payt',
  product_code text,
  event_type   text not null,
  buyer_email  text,
  payload      jsonb not null,
  processed    boolean not null default false,
  error        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- COMUNIDADE â€” FEED DE NOTÃCIAS (somente admin posta)
-- ============================================================
create table public.news_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  image_url  text,
  blocks     jsonb not null default '[]'::jsonb,  -- blocos extras (embed, etc.)
  pinned     boolean not null default false,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.news_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.news_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COMUNIDADE â€” FÃ“RUM POR CURSO
-- ============================================================
create table public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  image_url  text,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.forum_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  parent_id  uuid references public.forum_comments(id) on delete set null,  -- 1 nÃ­vel de aninhamento
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COMENTÃRIOS NAS AULAS
-- ============================================================
create table public.lesson_comments (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CURTIDAS (polimÃ³rfico: news_post | forum_post | forum_comment)
-- ============================================================
create table public.post_likes (
  target_type text not null check (target_type in ('news_post', 'forum_post', 'forum_comment')),
  target_id   uuid not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  primary key (target_type, target_id, user_id)
);

-- ============================================================
-- NOTIFICAÃ‡Ã•ES IN-APP
-- ============================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text not null default '',
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- MODERAÃ‡ÃƒO E AUDITORIA
-- ============================================================
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id   uuid not null,
  reason      text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  action      public.audit_action not null,
  target_type text not null,
  target_id   uuid,
  meta        jsonb,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- ÃNDICES DE PERFORMANCE
-- ============================================================

-- Busca full-text (pg_trgm)
create index if not exists idx_courses_title_trgm      on public.courses using gin (title gin_trgm_ops);
create index if not exists idx_lessons_title_trgm       on public.lessons using gin (title gin_trgm_ops);
create index if not exists idx_news_posts_title_trgm    on public.news_posts using gin (title gin_trgm_ops);

-- Filtros comuns
create index if not exists idx_courses_category         on public.courses(category_id);
create index if not exists idx_courses_published        on public.courses(published) where published = true;
create index if not exists idx_courses_product_code     on public.courses(product_code);
create index if not exists idx_modules_course           on public.modules(course_id, position);
create index if not exists idx_lessons_module           on public.lessons(module_id, position);

-- MatrÃ­cula e progresso
create index if not exists idx_enrollments_user         on public.enrollments(user_id);
create index if not exists idx_enrollments_course       on public.enrollments(course_id);
create index if not exists idx_lesson_progress_user     on public.lesson_progress(user_id);
create index if not exists idx_lesson_progress_lesson   on public.lesson_progress(lesson_id);

-- Comunidade
create index if not exists idx_forum_posts_course       on public.forum_posts(course_id, created_at desc);
create index if not exists idx_forum_comments_post      on public.forum_comments(post_id, created_at);
create index if not exists idx_news_posts_created       on public.news_posts(created_at desc) where published = true;
create index if not exists idx_news_comments_post       on public.news_comments(post_id, created_at);
create index if not exists idx_lesson_comments_lesson   on public.lesson_comments(lesson_id, created_at);
create index if not exists idx_post_likes_target        on public.post_likes(target_type, target_id);

-- NotificaÃ§Ãµes
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read) where read = false;
create index if not exists idx_notifications_user_date   on public.notifications(user_id, created_at desc);

-- Webhooks
create index if not exists idx_payment_events_pending   on public.payment_events(buyer_email) where processed = false;
create index if not exists idx_payment_events_created   on public.payment_events(created_at desc);

-- Banners
create index if not exists idx_banners_active           on public.banners(active, position_slot) where active = true;

-- ModeraÃ§Ã£o
create index if not exists idx_reports_unresolved       on public.reports(resolved) where resolved = false;


-- ============================================================
-- ROW LEVEL SECURITY â€” ativa em todas as tabelas
-- ============================================================

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.courses             enable row level security;
alter table public.modules             enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_content_blocks enable row level security;
alter table public.lesson_materials    enable row level security;
alter table public.showcase_courses    enable row level security;
alter table public.banners             enable row level security;
alter table public.menu_items          enable row level security;
alter table public.static_pages        enable row level security;
alter table public.enrollments         enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.certificates        enable row level security;
alter table public.payment_events      enable row level security;
alter table public.news_posts          enable row level security;
alter table public.news_comments       enable row level security;
alter table public.forum_posts         enable row level security;
alter table public.forum_comments      enable row level security;
alter table public.lesson_comments     enable row level security;
alter table public.post_likes          enable row level security;
alter table public.notifications       enable row level security;
alter table public.reports             enable row level security;
alter table public.audit_log           enable row level security;

-- Helper: verifica se o usuÃ¡rio atual Ã© admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: verifica se o usuÃ¡rio estÃ¡ matriculado no curso
create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.enrollments
    where user_id = auth.uid()
      and course_id = p_course_id
      and (expires_at is null or expires_at > now())
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "Leitura prÃ³prio perfil" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin lÃª todos os perfis" on public.profiles
  for select using (public.is_admin());

create policy "Atualizar prÃ³prio perfil" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "Admin atualiza qualquer perfil" on public.profiles
  for update using (public.is_admin());

-- ============================================================
-- CATEGORIES
-- ============================================================
create policy "Categorias pÃºblicas" on public.categories
  for select using (true);

create policy "Admin gerencia categorias" on public.categories
  for all using (public.is_admin());

-- ============================================================
-- COURSES
-- ============================================================
create policy "Cursos publicados visÃ­veis a todos" on public.courses
  for select using (published = true);

create policy "Admin vÃª todos os cursos" on public.courses
  for select using (public.is_admin());

create policy "Admin gerencia cursos" on public.courses
  for all using (public.is_admin());

-- ============================================================
-- MODULES
-- ============================================================
create policy "MÃ³dulos de cursos publicados" on public.modules
  for select using (
    exists (select 1 from public.courses where id = course_id and published = true)
  );

create policy "Admin gerencia mÃ³dulos" on public.modules
  for all using (public.is_admin());

-- ============================================================
-- LESSONS
-- ============================================================
-- PrÃ©via gratuita: qualquer um pode ver a aula (mas nÃ£o o video_panda_id â€” controlado na app)
create policy "PrÃ©via pÃºblica" on public.lessons
  for select using (is_preview = true);

-- Matriculada vÃª as aulas do curso
create policy "Matriculada vÃª aulas" on public.lessons
  for select using (
    public.is_enrolled(
      (select course_id from public.modules where id = module_id)
    )
  );

create policy "Admin gerencia aulas" on public.lessons
  for all using (public.is_admin());

-- ============================================================
-- LESSON_CONTENT_BLOCKS
-- ============================================================
create policy "Acesso a blocos = acesso Ã  aula" on public.lesson_content_blocks
  for select using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_id
        and (l.is_preview = true or public.is_enrolled(m.course_id))
    )
  );

create policy "Admin gerencia blocos" on public.lesson_content_blocks
  for all using (public.is_admin());

-- ============================================================
-- LESSON_MATERIALS
-- ============================================================
create policy "Matriculada acessa materiais" on public.lesson_materials
  for select using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_id and public.is_enrolled(m.course_id)
    )
  );

create policy "Admin gerencia materiais" on public.lesson_materials
  for all using (public.is_admin());

-- ============================================================
-- SHOWCASE_COURSES
-- ============================================================
create policy "Vitrine pÃºblica" on public.showcase_courses
  for select using (active = true);

create policy "Admin gerencia vitrine" on public.showcase_courses
  for all using (public.is_admin());

-- ============================================================
-- BANNERS
-- ============================================================
create policy "Banners ativos visÃ­veis" on public.banners
  for select using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "Admin gerencia banners" on public.banners
  for all using (public.is_admin());

-- ============================================================
-- MENU_ITEMS
-- ============================================================
create policy "Menu pÃºblico para guest" on public.menu_items
  for select using (visible_to = 'guest');

create policy "Menu student para autenticados" on public.menu_items
  for select using (auth.uid() is not null and visible_to in ('guest', 'student'));

create policy "Menu admin para admins" on public.menu_items
  for select using (public.is_admin());

create policy "Admin gerencia menu" on public.menu_items
  for all using (public.is_admin());

-- ============================================================
-- STATIC_PAGES
-- ============================================================
create policy "PÃ¡ginas publicadas visÃ­veis" on public.static_pages
  for select using (published = true);

create policy "Admin gerencia pÃ¡ginas" on public.static_pages
  for all using (public.is_admin());

-- ============================================================
-- ENROLLMENTS
-- ============================================================
create policy "Ver prÃ³prias matrÃ­culas" on public.enrollments
  for select using (auth.uid() = user_id);

create policy "Admin vÃª todas as matrÃ­culas" on public.enrollments
  for select using (public.is_admin());

create policy "Admin gerencia matrÃ­culas" on public.enrollments
  for all using (public.is_admin());

-- ============================================================
-- LESSON_PROGRESS
-- ============================================================
create policy "Ver e editar prÃ³prio progresso" on public.lesson_progress
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin vÃª todo o progresso" on public.lesson_progress
  for select using (public.is_admin());

-- ============================================================
-- CERTIFICATES
-- ============================================================
create policy "Ver prÃ³prios certificados" on public.certificates
  for select using (auth.uid() = user_id);

create policy "VerificaÃ§Ã£o pÃºblica por hash" on public.certificates
  for select using (true);  -- filtro por verify_hash feito na query

create policy "Admin vÃª todos os certificados" on public.certificates
  for select using (public.is_admin());

-- ============================================================
-- PAYMENT_EVENTS
-- ============================================================
-- Apenas service role (via webhook endpoint) insere aqui
create policy "Admin vÃª eventos de pagamento" on public.payment_events
  for select using (public.is_admin());

-- ============================================================
-- NEWS_POSTS
-- ============================================================
create policy "Posts publicados visÃ­veis a autenticados" on public.news_posts
  for select using (published = true and auth.uid() is not null);

create policy "Admin gerencia feed de notÃ­cias" on public.news_posts
  for all using (public.is_admin());

-- ============================================================
-- NEWS_COMMENTS
-- ============================================================
create policy "Ver comentÃ¡rios do feed" on public.news_comments
  for select using (auth.uid() is not null);

create policy "Comentar no feed" on public.news_comments
  for insert with check (auth.uid() = user_id);

create policy "Deletar prÃ³prio comentÃ¡rio" on public.news_comments
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia comentÃ¡rios do feed" on public.news_comments
  for all using (public.is_admin());

-- ============================================================
-- FORUM_POSTS
-- ============================================================
create policy "Matriculada vÃª posts do fÃ³rum do curso" on public.forum_posts
  for select using (public.is_enrolled(course_id));

create policy "Matriculada posta no fÃ³rum" on public.forum_posts
  for insert with check (auth.uid() = user_id and public.is_enrolled(course_id));

create policy "Deletar prÃ³prio post" on public.forum_posts
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia fÃ³rum" on public.forum_posts
  for all using (public.is_admin());

-- ============================================================
-- FORUM_COMMENTS
-- ============================================================
create policy "Matriculada vÃª comentÃ¡rios do fÃ³rum" on public.forum_comments
  for select using (
    exists (
      select 1 from public.forum_posts fp where fp.id = post_id and public.is_enrolled(fp.course_id)
    )
  );

create policy "Matriculada comenta no fÃ³rum" on public.forum_comments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.forum_posts fp where fp.id = post_id and public.is_enrolled(fp.course_id)
    )
  );

create policy "Deletar prÃ³prio comentÃ¡rio fÃ³rum" on public.forum_comments
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia comentÃ¡rios do fÃ³rum" on public.forum_comments
  for all using (public.is_admin());

-- ============================================================
-- LESSON_COMMENTS
-- ============================================================
create policy "Matriculada vÃª comentÃ¡rios da aula" on public.lesson_comments
  for select using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_id and public.is_enrolled(m.course_id)
    )
  );

create policy "Matriculada comenta na aula" on public.lesson_comments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = lesson_id and public.is_enrolled(m.course_id)
    )
  );

create policy "Deletar prÃ³prio comentÃ¡rio de aula" on public.lesson_comments
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia comentÃ¡rios de aulas" on public.lesson_comments
  for all using (public.is_admin());

-- ============================================================
-- POST_LIKES
-- ============================================================
create policy "Ver curtidas" on public.post_likes
  for select using (auth.uid() is not null);

create policy "Curtir" on public.post_likes
  for insert with check (auth.uid() = user_id);

create policy "Descurtir" on public.post_likes
  for delete using (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create policy "Ver prÃ³prias notificaÃ§Ãµes" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Marcar como lida" on public.notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- REPORTS
-- ============================================================
create policy "Reportar conteÃºdo" on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy "Admin gerencia reports" on public.reports
  for all using (public.is_admin());

-- ============================================================
-- AUDIT_LOG
-- ============================================================
create policy "Admin vÃª audit log" on public.audit_log
  for select using (public.is_admin());


-- ============================================================
-- TRIGGER: criar profile ao registrar usuÃ¡rio no Auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );

  -- Processar eventos Payt pendentes com este e-mail
  perform public.process_pending_payment_events(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FUNÃ‡ÃƒO: processar webhooks Payt pendentes por e-mail
-- Chamada ao criar perfil, para dar acesso retroativo
-- ============================================================
create or replace function public.process_pending_payment_events(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event     record;
  v_course    record;
  v_user_id   uuid;
begin
  select id into v_user_id from public.profiles where email = p_email;
  if v_user_id is null then return; end if;

  for v_event in
    select * from public.payment_events
    where buyer_email = p_email
      and processed = false
      and error is null
  loop
    -- Buscar curso pelo product_code
    select id into v_course from public.courses where product_code = v_event.product_code;

    if v_course.id is not null then
      insert into public.enrollments (user_id, course_id, source)
      values (v_user_id, v_course.id, 'payt')
      on conflict (user_id, course_id) do nothing;

      update public.payment_events set processed = true where id = v_event.id;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- TRIGGER: notificaÃ§Ã£o ao publicar post no feed de notÃ­cias
-- ============================================================
create or replace function public.notify_on_news_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published = true and (old is null or old.published = false) then
    insert into public.notifications (user_id, type, title, body, link)
    select
      p.id,
      'news_post',
      'Nova publicaÃ§Ã£o: ' || new.title,
      left(new.body, 100),
      '/comunidade/feed'
    from public.profiles p
    where p.role = 'student'
      and p.banned = false
      and (p.email_prefs->>'news_post')::boolean = true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_news_post_published on public.news_posts;
create trigger on_news_post_published
  after insert or update on public.news_posts
  for each row execute function public.notify_on_news_post();

-- ============================================================
-- TRIGGER: notificaÃ§Ã£o ao responder comentÃ¡rio
-- ============================================================
create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user uuid;
  v_post_title  text;
begin
  -- Notificar autor do post do fÃ³rum quando alguÃ©m comenta
  if TG_TABLE_NAME = 'forum_comments' then
    select fp.user_id, fp.title into v_parent_user, v_post_title
    from public.forum_posts fp where fp.id = new.post_id;

    if v_parent_user is not null and v_parent_user <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (
        v_parent_user,
        'comment_reply',
        'Nova resposta no seu post',
        left(new.body, 100),
        '/comunidade/forum'
      );
    end if;
  end if;

  -- Notificar autor do post de notÃ­cias
  if TG_TABLE_NAME = 'news_comments' then
    select np.author_id into v_parent_user
    from public.news_posts np where np.id = new.post_id;

    if v_parent_user is not null and v_parent_user <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (
        v_parent_user,
        'comment_reply',
        'Novo comentÃ¡rio no seu post',
        left(new.body, 100),
        '/comunidade/feed'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_forum_comment_created on public.forum_comments;
create trigger on_forum_comment_created
  after insert on public.forum_comments
  for each row execute function public.notify_on_comment_reply();

drop trigger if exists on_news_comment_created on public.news_comments;
create trigger on_news_comment_created
  after insert on public.news_comments
  for each row execute function public.notify_on_comment_reply();

-- ============================================================
-- TRIGGER: notificaÃ§Ã£o ao adicionar nova aula em curso matriculado
-- ============================================================
create or replace function public.notify_on_new_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_course_title text;
begin
  select m.course_id, c.title into v_course_id, v_course_title
  from public.modules m
  join public.courses c on c.id = m.course_id
  where m.id = new.module_id;

  insert into public.notifications (user_id, type, title, body, link)
  select
    e.user_id,
    'new_lesson',
    'Nova aula em ' || v_course_title,
    new.title,
    '/aulas/' || new.id
  from public.enrollments e
  where e.course_id = v_course_id
    and (e.expires_at is null or e.expires_at > now());

  return new;
end;
$$;

drop trigger if exists on_lesson_created on public.lessons;
create trigger on_lesson_created
  after insert on public.lessons
  for each row execute function public.notify_on_new_lesson();

