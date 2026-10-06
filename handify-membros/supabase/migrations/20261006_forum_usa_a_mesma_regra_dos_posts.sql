-- A politica de leitura de `forums` escrevia a regra de acesso a mao, exigindo
-- linha crua em `enrollments`. As tabelas vizinhas ja nao fazem isso: tanto
-- `forum_posts` quanto `forum_comments` chamam `is_forum_member()`, que aceita
-- matricula OU plano ativo com o curso marcado `in_plan`.
--
-- O resultado era uma assimetria: a aluna de plano sem matricula por curso
-- enxergava os POSTS mas nao enxergava o FORUM, e como a pagina busca o forum
-- primeiro (comunidade/forum/[forumSlug]/page.tsx:24-30), ela tomava notFound()
-- antes de chegar na checagem ciente do plano logo abaixo, cujo proprio
-- comentario diz "acesso pode vir do plano, não só de matrícula". Aquela
-- correcao era codigo morto para quem mais precisava dela.
--
-- Hoje a falha esta dormente: 89 alunas com Completo ativo e nenhuma sem
-- matricula nos cursos com forum. Ela acorda no dia em que uma compra do
-- Completo nao gravar matricula por curso, que e exatamente o caso para o qual
-- `in_plan` e o ramo de membership foram escritos.
--
-- Trocando a regra escrita a mao pela funcao, as tres tabelas passam a responder
-- pela MESMA definicao de acesso, e a proxima mudanca de regra nao pode mais
-- deixar uma delas para tras.
--
-- `is_forum_member` ja e STABLE SECURITY DEFINER com search_path vazio, e
-- devolve so um booleano sobre auth.uid(): para o anonimo, auth.uid() e nulo e
-- ela responde false.
--
-- Conferido depois de aplicar, com papel `authenticated` e o JWT de cada conta
-- de teste, tudo em transacao desfeita:
--   so-plano (assinatura ativa, zero matricula)  regra antiga: false  nova: true
--   matriculada (teste-e2e)                      ve os 2 foruns
--   sem curso e sem plano (teste-visitante)      ve 0 foruns
drop policy if exists "Membro lê fórum acessível" on public.forums;

create policy "Membro lê fórum acessível"
  on public.forums
  for select
  using (archived = false and public.is_forum_member(id));
