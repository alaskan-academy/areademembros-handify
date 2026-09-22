-- ─── O fórum tinha dois jeitos de dizer "esta aluna pode entrar" ────────────
--
-- forum_posts aceitava o caminho novo (forum_id) OU o legado (forum_id NULL +
-- course_id). forum_comments só conhece um: is_forum_member(fp.forum_id) — e
-- is_forum_member(NULL) é false. Num post criado pelo caminho legado a aluna
-- abriria o post, veria o botão de responder e não conseguiria comentar nem ler
-- comentário nenhum, sem mensagem de erro.
--
-- É a mesma forma do defeito que deixou o fórum mudo de 03/07 a 10/09/2026:
-- duas definições de "tem acesso" e a policy apoiada na errada.
--
-- Hoje ninguém está preso — 0 de 120 posts com forum_id nulo, e createForumPost
-- (src/app/(student)/comunidade/forum/actions.ts:116, o único insert em
-- forum_posts no código) sempre manda forum_id. O ramo legado sobrou só como
-- porta aberta no PostgREST direto: aluna com o próprio JWT criaria post órfão,
-- invisível em qualquer fórum e ainda assim contado na fila de moderação.
--
-- Em vez de copiar o ramo morto para as policies de comentário — guarda que
-- ninguém executaria —, fechamos a porta: forum_id vira obrigatório e as
-- policies de forum_posts param de consultar course_id. Com um caminho só, as
-- duas definições de acesso não têm mais como divergir de novo.

do $$
declare n integer;
begin
  select count(*) into n from public.forum_posts where forum_id is null;
  if n > 0 then
    raise exception 'D32: % post(s) com forum_id nulo. Preencha forum_id (courses.forum_id do course_id) antes de rodar.', n;
  end if;
end $$;

alter table public.forum_posts alter column forum_id set not null;

comment on column public.forum_posts.course_id is
  'Coluna legada do forum por curso. Nenhuma policy e nenhum codigo consultam mais. Nao usar para controle de acesso.';

-- Nomes com acento exatamente como estão no banco: errar o acento cria policy
-- nova e deixa a antiga viva. A de SELECT continua sem cláusula TO (role
-- public, como hoje) e a de INSERT continua TO authenticated — trocar isso
-- mudaria quem lê.
drop policy if exists "Aluna lê post do fórum" on public.forum_posts;
create policy "Aluna lê post do fórum" on public.forum_posts
  for select using (
    (approved = true or user_id = auth.uid())
    and public.is_forum_member(forum_id)
  );

drop policy if exists "Aluna cria post no fórum" on public.forum_posts;
create policy "Aluna cria post no fórum" on public.forum_posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_forum_member(forum_id)
  );

comment on policy "Matriculada comenta no fórum" on public.forum_comments is
  'Um unico caminho de acesso: is_forum_member(forum_posts.forum_id). forum_posts.forum_id e NOT NULL desde 22/09/2026 (D32).';
