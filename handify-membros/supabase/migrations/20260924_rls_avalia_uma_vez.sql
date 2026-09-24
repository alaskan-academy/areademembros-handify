-- ─── A RLS chamava auth.uid() e is_admin() uma vez POR LINHA ──────────────
--
-- Medido em 24/09/2026, em produção, com o token de uma aluna de verdade:
--
--   select id from enrollments limit 1
--     Seq Scan on enrollments ......................... 315 ms
--     Filter: (auth.uid() = user_id OR is_admin() OR is_admin())
--     Rows Removed by Filter: 6.928   Buffers: shared hit=42.002
--
-- A mesma consulta com a service role (sem RLS) leva menos de 1 ms. O banco
-- não estava lento: a política é que era reexecutada 12.431 vezes, e cada
-- execução chamava `is_admin()` duas vezes — uma consulta em `profiles` por
-- linha de matrícula.
--
-- Isso não ficava só nas matrículas. A policy de `inspiration_posts` pergunta
-- "ela tem alguma matrícula viva?", e essa pergunta arrastava o Seq Scan
-- inteiro para dentro da consulta do feed:
--
--   feed de /inspiracoes, 7 posts
--     antes ........ 513 ms   (509 ms só no Seq Scan de enrollments)
--     depois .......   7 ms
--
-- ── O que muda ────────────────────────────────────────────────────────────
--
-- `auth.uid()` e `is_admin()` viram `(select auth.uid())` e
-- `(select public.is_admin())`. É a recomendação do próprio Supabase: dentro de
-- um subselect sem referência à linha, o Postgres avalia como InitPlan — uma
-- vez por consulta, não uma vez por linha. O valor é idêntico (as duas funções
-- são STABLE e não olham a linha), então NENHUMA regra de acesso muda. Quem via
-- continua vendo, quem não via continua sem ver.
--
-- Usa `alter policy` de propósito, nunca `drop` + `create`: a política nunca
-- deixa de existir, nem por um instante. Um `drop` numa tabela como `profiles`
-- abriria a tabela inteira para qualquer aluna logada durante a janela.
--
-- ── Escopo ────────────────────────────────────────────────────────────────
--
-- Só as tabelas em que o custo por linha aparece: 500 linhas ou mais, mais
-- `inspiration_posts` (19 linhas, mas é a policy que arrastava o Seq Scan de
-- enrollments). As outras ~100 políticas com o mesmo padrão estão em tabelas de
-- dezenas de linhas — o custo é de microssegundos e a troca em massa custaria
-- mais risco do que tempo. Ficam para quando alguma delas crescer.
--
-- As policies que já usam `exists (select 1 from profiles where id = auth.uid())`
-- ficam como estão: um EXISTS sem referência à linha JÁ vira InitPlan sozinho —
-- conferido no EXPLAIN, aparece como "never executed" quando a primeira condição
-- resolve. O problema é a chamada de função solta, não o subselect.

-- ── enrollments (12.431 linhas) ────────────────────────────────────────────
alter policy "Ver próprias matrículas" on public.enrollments
  using ((select auth.uid()) = user_id);

alter policy "Admin vê todas as matrículas" on public.enrollments
  using ((select public.is_admin()));

alter policy "Admin gerencia matrículas" on public.enrollments
  using ((select public.is_admin()));

-- ── lesson_progress (33.091 linhas — a maior da base) ──────────────────────
alter policy "Ver e editar próprio progresso" on public.lesson_progress
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Admin vê todo o progresso" on public.lesson_progress
  using ((select public.is_admin()));

-- ── payment_events (12.957 linhas) ─────────────────────────────────────────
alter policy "Admin vê eventos de pagamento" on public.payment_events
  using ((select public.is_admin()));

-- ── notifications (5.471 linhas) ───────────────────────────────────────────
alter policy "Ver próprias notificações" on public.notifications
  using ((select auth.uid()) = user_id);

alter policy "Marcar como lida" on public.notifications
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── profiles (4.714 linhas) — NÃO MEXER, e o motivo ────────────────────────
--
-- Tentei, e a prova de escrita pegou antes de subir:
--
--   update profiles set bio = '...' where id = <a propria>
--     ERRO: infinite recursion detected in policy for relation "profiles"
--
-- `profiles` é a única tabela cuja policy consulta a PRÓPRIA tabela: o
-- with_check de "Atualizar próprio perfil" tem
-- `role = (select role from profiles where id = auth.uid())` — a trava que
-- impede a aluna de se promover a admin editando o próprio perfil. Hoje as
-- policies de SELECT são expressões simples, e o Postgres as expande em linha
-- dentro desse subselect sem se perder. Trocando `auth.uid() = id` por
-- `(select auth.uid()) = id`, a policy de leitura passa a conter um subselect
-- também, e o detector de recursão do Postgres — que é conservador — desiste.
-- Resultado: a aluna não conseguiria mais editar a própria bio.
--
-- E não haveria ganho nenhum: no EXPLAIN do feed a busca do perfil da autora
-- é Index Scan em profiles_pkey, 0,09 ms em 7 execuções. `profiles` nunca foi
-- o gargalo — os 509 ms eram todos de `enrollments`.

-- ── email_campaign_sends (1.720 linhas) ────────────────────────────────────
alter policy "Admin ve os envios" on public.email_campaign_sends
  using ((select public.is_admin()));

-- ── push_subscriptions (1.446 linhas) ──────────────────────────────────────
alter policy "push_subs_own" on public.push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── audit_log (1.155 linhas) ───────────────────────────────────────────────
alter policy "Admin vê audit log" on public.audit_log
  using ((select public.is_admin()));

-- ── inspiration_posts (19 linhas, mas é a porta do feed) ───────────────────
--
-- Aqui as três perguntas viram InitPlan: `is_admin()`, `has_active_membership()`
-- e o EXISTS das matrículas. O EXISTS já era InitPlan; o que custava era ele ter
-- de varrer `enrollments` com a policy velha — resolvido acima.
alter policy "Alunas veem posts publicados de inspiração" on public.inspiration_posts
  using (
    published = true
    and archived = false
    and (
      (select public.is_admin())
      or (select public.has_active_membership((select auth.uid())))
      or exists (
        select 1 from public.enrollments e
        where e.user_id = (select auth.uid())
          and (e.expires_at is null or e.expires_at > now())
      )
    )
  );

alter policy "Admins gerenciam posts de inspiração" on public.inspiration_posts
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'::role_type
    )
  );
