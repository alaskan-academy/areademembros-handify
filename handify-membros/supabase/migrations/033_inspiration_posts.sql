-- ── Inspirações — Feed visual estilo Instagram (só Handify posta) ────────────

-- Post principal
create table if not exists inspiration_posts (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid not null references profiles(id),
  type                text not null check (type in ('foto','carrossel','video','receita','dica','destaque')),
  title               text not null,
  body                text,
  -- Mídia
  media               jsonb not null default '[]',   -- [{url, alt, order}] para foto/carrossel
  video_url           text,                          -- URL YouTube ou Panda Video
  -- Blocos HTML (mesmo padrão de lesson_content_blocks)
  blocks              jsonb not null default '[]',   -- [{type, content, position}]
  -- Receita (herança da biblioteca-handify)
  recipe_data         jsonb,                         -- {ingredientes, passos, tempo, temperatura, nivel, paleta_cores, custo_medio, preco_venda, dicas}
  -- Categorização
  tags                text[] not null default '{}',  -- nichos: velas, sabonetes, costura, etc.
  course_id           uuid references courses(id) on delete set null,
  -- Destaque de aluna
  featured_student_id uuid references profiles(id) on delete set null,
  -- Publishing
  published           boolean not null default false,
  archived            boolean not null default false,
  pinned              boolean not null default false,
  -- Auditoria
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Likes
create table if not exists inspiration_likes (
  post_id   uuid not null references inspiration_posts(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Bookmarks (salvar post)
create table if not exists inspiration_bookmarks (
  post_id    uuid not null references inspiration_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Comentários com moderação obrigatória (approved = false por padrão)
create table if not exists inspiration_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references inspiration_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 2 and 2000),
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────

-- Busca full-text via pg_trgm (mesma extensão já usada no projeto)
create index if not exists inspiration_posts_search_idx
  on inspiration_posts
  using gin ((title || ' ' || coalesce(body, '')) gin_trgm_ops);

-- Feed principal: publicados, não arquivados, ordenados por data
create index if not exists idx_inspiration_posts_feed
  on inspiration_posts (published, archived, pinned desc, created_at desc)
  where published = true and archived = false;

-- Filtro por tag de nicho
create index if not exists idx_inspiration_posts_tags
  on inspiration_posts using gin (tags);

-- Filtro por tipo
create index if not exists idx_inspiration_posts_type
  on inspiration_posts (type, published, archived);

-- Filtro por curso relacionado
create index if not exists idx_inspiration_posts_course
  on inspiration_posts (course_id)
  where course_id is not null;

-- Likes por post (contagem)
create index if not exists idx_inspiration_likes_post
  on inspiration_likes (post_id);

-- Bookmarks por usuário
create index if not exists idx_inspiration_bookmarks_user
  on inspiration_bookmarks (user_id, created_at desc);

-- Comentários pendentes de moderação
create index if not exists idx_inspiration_comments_pending
  on inspiration_comments (approved, created_at desc)
  where approved = false;

-- Comentários por post (aprovados, para exibição)
create index if not exists idx_inspiration_comments_post_approved
  on inspiration_comments (post_id, approved, created_at asc);

-- ── Trigger updated_at ───────────────────────────────────────────────────────
create or replace function touch_inspiration_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inspiration_posts_updated_at
  before update on inspiration_posts
  for each row execute function touch_inspiration_posts_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table inspiration_posts     enable row level security;
alter table inspiration_likes     enable row level security;
alter table inspiration_bookmarks enable row level security;
alter table inspiration_comments  enable row level security;

-- inspiration_posts — alunas leem publicados e não arquivados; admin gerencia tudo
create policy "Alunas veem posts publicados de inspiração"
  on inspiration_posts for select
  using (
    published = true
    and archived = false
    and auth.role() = 'authenticated'
  );

create policy "Admins gerenciam posts de inspiração"
  on inspiration_posts for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- inspiration_likes — alunas inserem/deletam os próprios; leem todos
create policy "Alunas veem likes"
  on inspiration_likes for select
  using (auth.role() = 'authenticated');

create policy "Alunas inserem próprio like"
  on inspiration_likes for insert
  with check (user_id = auth.uid() and auth.role() = 'authenticated');

create policy "Alunas removem próprio like"
  on inspiration_likes for delete
  using (user_id = auth.uid());

create policy "Admins gerenciam likes"
  on inspiration_likes for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- inspiration_bookmarks — cada aluna gerencia os próprios
create policy "Alunas gerenciam próprios bookmarks"
  on inspiration_bookmarks for all
  using (user_id = auth.uid());

create policy "Admins gerenciam bookmarks"
  on inspiration_bookmarks for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- inspiration_comments — alunas veem aprovados; inserem os próprios; admin modera tudo
create policy "Alunas veem comentários aprovados"
  on inspiration_comments for select
  using (approved = true and auth.role() = 'authenticated');

create policy "Alunas inserem próprio comentário"
  on inspiration_comments for insert
  with check (user_id = auth.uid() and auth.role() = 'authenticated');

create policy "Admins gerenciam comentários de inspiração"
  on inspiration_comments for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
