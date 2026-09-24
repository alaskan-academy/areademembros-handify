-- ─── profiles: tirar a auto-referência para a RLS poder avaliar uma vez ───
--
-- Continuação de `20260924_rls_avalia_uma_vez.sql`, que deixou `profiles` de
-- fora porque a troca quebrava a tabela. Aqui o motivo cai.
--
-- ── O custo ───────────────────────────────────────────────────────────────
--
-- `select role from profiles limit 1` — a consulta que o `getViewer()` faz em
-- TODA página da plataforma, para saber se quem entrou é admin:
--
--   Seq Scan on profiles ............................. 226 ms
--   Filter: (auth.uid() = id OR is_admin())
--
-- `is_admin()` é uma consulta em `profiles`, chamada uma vez por linha das
-- 4.714. Depois desta migration: 6,7 ms.
--
-- ── Por que não deu para fazer junto com as outras ────────────────────────
--
-- `profiles` é a única tabela cuja policy consulta a PRÓPRIA tabela. O
-- with_check de "Atualizar próprio perfil" tinha:
--
--   role = (select role from profiles where id = auth.uid())
--
-- que é a trava que impede a aluna de se promover a admin editando o próprio
-- perfil. Esse subselect faz o Postgres expandir as policies de SELECT de
-- `profiles` dentro dele. Enquanto essas policies são expressões simples, ele
-- expande em linha e segue. No instante em que uma delas ganha um subselect —
-- `(select auth.uid()) = id`, ou `(select is_admin())`, tanto faz — o detector
-- de recursão desiste:
--
--   ERRO: infinite recursion detected in policy for relation "profiles"
--
-- e a aluna deixa de conseguir editar a própria bio. Conferido: as duas
-- tentativas parciais quebraram exatamente assim.
--
-- ── A saída ───────────────────────────────────────────────────────────────
--
-- `role_atual()` responde a mesma pergunta sem tocar em `profiles` de dentro
-- de uma policy: é SECURITY DEFINER, então a RLS não é expandida lá dentro, e
-- a auto-referência some. Com ela fora do caminho, os subselects entram.
--
-- A ordem importa: primeiro o with_check para de consultar `profiles`, só
-- depois as policies de SELECT ganham subselect. Invertido, quebra no meio.
--
-- ── Provado antes de aplicar ──────────────────────────────────────────────
--
-- Sete conferências, antes e depois, todas idênticas (com `get diagnostics
-- row_count`, não `found` — `found` mente depois de um `perform`):
--
--   aluna edita a própria bio ............ 1 linha    (continua podendo)
--   aluna se promove a admin ............. bloqueado  (a trava segura)
--   aluna edita o perfil da admin ........ 0 linhas
--   perfis que a aluna enxerga ........... 1
--   admin edita o perfil de uma aluna .... 1 linha
--   perfis que a admin enxerga ........... todos
--   perfis que a anônima enxerga ......... 0

create or replace function public.role_atual()
returns public.role_type
language sql
stable
security definer
set search_path to ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

comment on function public.role_atual() is
  'O role de quem esta logado, sem expandir RLS de profiles. Existe para tirar a auto-referencia do with_check de "Atualizar proprio perfil" — ver a migration 20260924_rls_profiles_sem_auto_referencia.';

-- Devolve só o role de quem chamou, então não expõe nada de ninguém. Ainda
-- assim o revoke é de PUBLIC, não de anon/authenticated: os dois herdam de
-- PUBLIC, e revogar deles não fecha nada.
revoke all on function public.role_atual() from public;
grant execute on function public.role_atual() to authenticated, anon, service_role;

-- 1º: a auto-referência sai.
alter policy "Atualizar próprio perfil" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role = (select public.role_atual()));

-- 2º: agora as de leitura podem virar InitPlan.
alter policy "Leitura próprio perfil" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Admin lê todos os perfis" on public.profiles
  using ((select public.is_admin()));

alter policy "Admin atualiza qualquer perfil" on public.profiles
  using ((select public.is_admin()));
