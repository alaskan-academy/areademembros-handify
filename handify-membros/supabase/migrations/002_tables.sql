-- ============================================================
-- RESET TOTAL — drop tudo no schema public
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

-- Drop funções antigas se existirem
drop function if exists public.is_admin() cascade;
drop function if exists public.is_enrolled(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.process_pending_payment_events(text) cascade;
drop function if exists public.notify_on_news_post() cascade;
drop function if exists public.notify_on_comment_reply() cascade;
drop function if exists public.notify_on_new_lesson() cascade;

-- ============================================================
-- INÍCIO DO NOVO SCHEMA
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
-- USUÁRIOS
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
-- CATÁLOGO
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
  is_preview       boolean not null default false,  -- acessível sem matrícula
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
  sales_video_panda_id text,   -- ID do vídeo de vendas (mini PV) — diferente do vídeo de aula
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
  product_codes text[] not null default '{}',           -- banners exibidos a quem NÃO tem esses product_codes
  position_slot public.banner_slot not null default 'header',
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- MENU EDITÁVEL
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
-- PÁGINAS ESTÁTICAS
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
-- COMUNIDADE — FEED DE NOTÍCIAS (somente admin posta)
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
-- COMUNIDADE — FÓRUM POR CURSO
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
  parent_id  uuid references public.forum_comments(id) on delete set null,  -- 1 nível de aninhamento
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COMENTÁRIOS NAS AULAS
-- ============================================================
create table public.lesson_comments (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CURTIDAS (polimórfico: news_post | forum_post | forum_comment)
-- ============================================================
create table public.post_likes (
  target_type text not null check (target_type in ('news_post', 'forum_post', 'forum_comment')),
  target_id   uuid not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  primary key (target_type, target_id, user_id)
);

-- ============================================================
-- NOTIFICAÇÕES IN-APP
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
-- MODERAÇÃO E AUDITORIA
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
