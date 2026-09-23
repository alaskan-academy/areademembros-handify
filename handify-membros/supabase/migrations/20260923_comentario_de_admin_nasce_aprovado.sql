-- Comentário do acervo de Inspirações: só o da admin nasce aprovado.
--
-- O app passou a gravar `approved = true` quando quem comenta tem role = admin.
-- Antes gravava `false` para todo mundo: a Jessica respondia uma dúvida dentro
-- do acervo e a própria resposta sumia da tela até ela ir na fila de moderação
-- aprovar a si mesma. Os 12 comentários de admin que existem hoje deram essa
-- volta, um por um.
--
-- Esta migration é a metade que faltava no banco. A policy de insert das alunas
-- olhava só `user_id = auth.uid()`; o valor de `approved` ia livre. Como a chave
-- anônima e o token de sessão estão os dois no navegador, qualquer aluna logada
-- podia inserir o próprio comentário já com `approved = true` pelo supabase-js e
-- publicar no acervo sem passar por moderação — inclusive num post de curso que
-- as outras alunas leem.
--
-- A admin continua gravando aprovado: policies permissivas se somam (OR), e o
-- teste de admin fica explícito aqui para não depender da policy "Admins
-- gerenciam comentários de inspiração" ser avaliada. `is_admin()` é SECURITY
-- DEFINER com search_path fixo e só enxerga a linha de quem chamou, então não
-- abre leitura de perfil de ninguém.
--
-- UPDATE não precisa de ajuste: aluna não tem policy de update nesta tabela, só
-- a de admin — ninguém vira o próprio `approved` depois de gravado.

drop policy if exists "Alunas inserem próprio comentário" on public.inspiration_comments;

create policy "Alunas inserem próprio comentário"
  on public.inspiration_comments
  for insert
  with check (
    user_id = auth.uid()
    and auth.role() = 'authenticated'
    and (approved = false or public.is_admin())
  );
