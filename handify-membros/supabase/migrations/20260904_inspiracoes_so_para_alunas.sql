-- Inspiracoes e beneficio de aluna (decisao da Jessica, 04/09). A tela ja
-- mostra "so para alunas" a quem nao tem curso, mas no banco qualquer conta
-- logada ainda lia — bastava chamar a API direto com a sessao. Aqui o cadeado
-- deixa de ser so da tela.
--
-- Avisos (news_posts) continua aberto de proposito: e o canal para quem ainda
-- nao comprou. Quem publica la e a equipe e o card so deixa curtir.

drop policy if exists "Alunas veem posts publicados de inspiração" on public.inspiration_posts;

create policy "Alunas veem posts publicados de inspiração" on public.inspiration_posts
  for select to authenticated
  using (
    published = true
    and archived = false
    and (
      public.is_admin()
      or public.has_active_membership(auth.uid())
      or exists (
        select 1 from public.enrollments e
        where e.user_id = auth.uid()
          and (e.expires_at is null or e.expires_at > now())
      )
    )
  );
