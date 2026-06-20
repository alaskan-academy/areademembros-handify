-- ============================================================
-- ROW LEVEL SECURITY — ativa em todas as tabelas
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

-- Helper: verifica se o usuário atual é admin
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

-- Helper: verifica se o usuário está matriculado no curso
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
create policy "Leitura próprio perfil" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin lê todos os perfis" on public.profiles
  for select using (public.is_admin());

create policy "Atualizar próprio perfil" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "Admin atualiza qualquer perfil" on public.profiles
  for update using (public.is_admin());

-- ============================================================
-- CATEGORIES
-- ============================================================
create policy "Categorias públicas" on public.categories
  for select using (true);

create policy "Admin gerencia categorias" on public.categories
  for all using (public.is_admin());

-- ============================================================
-- COURSES
-- ============================================================
create policy "Cursos publicados visíveis a todos" on public.courses
  for select using (published = true);

create policy "Admin vê todos os cursos" on public.courses
  for select using (public.is_admin());

create policy "Admin gerencia cursos" on public.courses
  for all using (public.is_admin());

-- ============================================================
-- MODULES
-- ============================================================
create policy "Módulos de cursos publicados" on public.modules
  for select using (
    exists (select 1 from public.courses where id = course_id and published = true)
  );

create policy "Admin gerencia módulos" on public.modules
  for all using (public.is_admin());

-- ============================================================
-- LESSONS
-- ============================================================
-- Prévia gratuita: qualquer um pode ver a aula (mas não o video_panda_id — controlado na app)
create policy "Prévia pública" on public.lessons
  for select using (is_preview = true);

-- Matriculada vê as aulas do curso
create policy "Matriculada vê aulas" on public.lessons
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
create policy "Acesso a blocos = acesso à aula" on public.lesson_content_blocks
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
create policy "Vitrine pública" on public.showcase_courses
  for select using (active = true);

create policy "Admin gerencia vitrine" on public.showcase_courses
  for all using (public.is_admin());

-- ============================================================
-- BANNERS
-- ============================================================
create policy "Banners ativos visíveis" on public.banners
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
create policy "Menu público para guest" on public.menu_items
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
create policy "Páginas publicadas visíveis" on public.static_pages
  for select using (published = true);

create policy "Admin gerencia páginas" on public.static_pages
  for all using (public.is_admin());

-- ============================================================
-- ENROLLMENTS
-- ============================================================
create policy "Ver próprias matrículas" on public.enrollments
  for select using (auth.uid() = user_id);

create policy "Admin vê todas as matrículas" on public.enrollments
  for select using (public.is_admin());

create policy "Admin gerencia matrículas" on public.enrollments
  for all using (public.is_admin());

-- ============================================================
-- LESSON_PROGRESS
-- ============================================================
create policy "Ver e editar próprio progresso" on public.lesson_progress
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin vê todo o progresso" on public.lesson_progress
  for select using (public.is_admin());

-- ============================================================
-- CERTIFICATES
-- ============================================================
create policy "Ver próprios certificados" on public.certificates
  for select using (auth.uid() = user_id);

create policy "Verificação pública por hash" on public.certificates
  for select using (true);  -- filtro por verify_hash feito na query

create policy "Admin vê todos os certificados" on public.certificates
  for select using (public.is_admin());

-- ============================================================
-- PAYMENT_EVENTS
-- ============================================================
-- Apenas service role (via webhook endpoint) insere aqui
create policy "Admin vê eventos de pagamento" on public.payment_events
  for select using (public.is_admin());

-- ============================================================
-- NEWS_POSTS
-- ============================================================
create policy "Posts publicados visíveis a autenticados" on public.news_posts
  for select using (published = true and auth.uid() is not null);

create policy "Admin gerencia feed de notícias" on public.news_posts
  for all using (public.is_admin());

-- ============================================================
-- NEWS_COMMENTS
-- ============================================================
create policy "Ver comentários do feed" on public.news_comments
  for select using (auth.uid() is not null);

create policy "Comentar no feed" on public.news_comments
  for insert with check (auth.uid() = user_id);

create policy "Deletar próprio comentário" on public.news_comments
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia comentários do feed" on public.news_comments
  for all using (public.is_admin());

-- ============================================================
-- FORUM_POSTS
-- ============================================================
create policy "Matriculada vê posts do fórum do curso" on public.forum_posts
  for select using (public.is_enrolled(course_id));

create policy "Matriculada posta no fórum" on public.forum_posts
  for insert with check (auth.uid() = user_id and public.is_enrolled(course_id));

create policy "Deletar próprio post" on public.forum_posts
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia fórum" on public.forum_posts
  for all using (public.is_admin());

-- ============================================================
-- FORUM_COMMENTS
-- ============================================================
create policy "Matriculada vê comentários do fórum" on public.forum_comments
  for select using (
    exists (
      select 1 from public.forum_posts fp where fp.id = post_id and public.is_enrolled(fp.course_id)
    )
  );

create policy "Matriculada comenta no fórum" on public.forum_comments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.forum_posts fp where fp.id = post_id and public.is_enrolled(fp.course_id)
    )
  );

create policy "Deletar próprio comentário fórum" on public.forum_comments
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia comentários do fórum" on public.forum_comments
  for all using (public.is_admin());

-- ============================================================
-- LESSON_COMMENTS
-- ============================================================
create policy "Matriculada vê comentários da aula" on public.lesson_comments
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

create policy "Deletar próprio comentário de aula" on public.lesson_comments
  for delete using (auth.uid() = user_id);

create policy "Admin gerencia comentários de aulas" on public.lesson_comments
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
create policy "Ver próprias notificações" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Marcar como lida" on public.notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- REPORTS
-- ============================================================
create policy "Reportar conteúdo" on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy "Admin gerencia reports" on public.reports
  for all using (public.is_admin());

-- ============================================================
-- AUDIT_LOG
-- ============================================================
create policy "Admin vê audit log" on public.audit_log
  for select using (public.is_admin());
