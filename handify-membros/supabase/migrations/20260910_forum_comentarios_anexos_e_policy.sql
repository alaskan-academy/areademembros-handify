-- ─── 1. Imagem e anexo na resposta do fórum ──────────────────────────────────
-- O post já tinha os três campos; a resposta não. Na prática a aluna respondia
-- "ficou assim ó" e não tinha como mostrar — que é justamente o que ela quer
-- fazer num fórum de artesanato.
alter table public.forum_comments
  add column if not exists image_url       text,
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text;

comment on column public.forum_comments.image_url is
  'Foto da resposta. Sobe por uploadForumFile no bucket community, pasta forum/<user_id>/.';
comment on column public.forum_comments.attachment_name is
  'Nome original do arquivo, para mostrar no link em vez da URL.';

-- ─── 2. Nenhuma aluna conseguia responder desde 03/07/2026 ───────────────────
-- As policies de forum_comments checavam is_enrolled(fp.course_id), mas
-- forum_posts.course_id é coluna legada: o fórum passou a ser identificado por
-- forum_id e os 90 posts existentes têm course_id NULL. is_enrolled(NULL) é
-- false, então todo INSERT de aluna era negado em silêncio.
--
-- Os 160 comentários do fórum são TODOS da admin, que passa pela policy
-- is_admin(). Em 03/09 eu li esse número no painel de métricas e reportei como
-- "engajamento zero das alunas" — era a policy, não desinteresse.
--
-- A leitura continuava funcionando porque getForumComments usa o cliente de
-- serviço, que passa por cima do RLS. Só a escrita batia na policy.
drop policy if exists "Matriculada comenta no fórum" on public.forum_comments;
create policy "Matriculada comenta no fórum" on public.forum_comments
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.forum_posts fp
      where fp.id = forum_comments.post_id
        and public.is_forum_member(fp.forum_id)
    )
  );

drop policy if exists "Matriculada vê comentários do fórum" on public.forum_comments;
create policy "Matriculada vê comentários do fórum" on public.forum_comments
  for select
  using (
    exists (
      select 1 from public.forum_posts fp
      where fp.id = forum_comments.post_id
        and public.is_forum_member(fp.forum_id)
    )
  );

-- ─── 3. Policies mortas em forum_posts ───────────────────────────────────────
-- A migração para forum_id atualizou as policies de forum_posts mas deixou as
-- antigas para trás. Como policies do mesmo comando são combinadas com OU, elas
-- não bloqueavam nada — mas apontam para course_id, que é NULL nos 90 posts, e
-- foi olhar uma dessas em forum_comments que custou dois meses de fórum mudo.
--
-- Seguro remover: todo post tem forum_id (conferido: 0 com forum_id nulo), e as
-- policies novas já cobrem os dois casos.
drop policy if exists "Matriculada posta no fórum" on public.forum_posts;
drop policy if exists "Matriculada vê posts do fórum do curso" on public.forum_posts;
