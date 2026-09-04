-- URGENTE (04/09): o menu sumia inteiro para quem nao e admin.
--
-- A migracao `20260903_menu_por_tier.sql` moveu todas as linhas de
-- guest/student para 'visitante', mas a policy de leitura continuou exigindo
-- `visible_to IN ('guest','student')`. Para qualquer conta que nao fosse admin
-- a consulta do menu voltava ZERO linhas, e a aluna ficava sem menu nenhum.
-- O layout le `menu_items` com o cliente da propria aluna, entao o RLS derruba
-- de verdade. Admin nao via o problema por causa da policy `is_admin()` — foi
-- por isso que passou despercebido no teste.
--
-- Licao para a proxima: ao renomear valor de enum usado em policy, procurar o
-- valor antigo em `pg_policy` antes de dar o update nas linhas.
--
-- Correcao: quem esta logada le todo item ativo que nao seja de admin. O
-- recorte por tier continua na aplicacao (StudentNav, TIER_RANK), que e onde
-- ele ja era feito; aqui embaixo a regra e so "nao e item de admin".

drop policy if exists "Menu student para autenticados" on public.menu_items;
drop policy if exists "Menu público para guest" on public.menu_items;

create policy "Menu para quem esta logada" on public.menu_items
  for select to authenticated
  using (active = true and visible_to <> 'admin'::menu_visibility);
