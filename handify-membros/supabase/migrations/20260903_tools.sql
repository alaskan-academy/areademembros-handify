-- Ferramentas por tier e por categoria de curso.
-- Contexto e decisoes em .claude/plans/tiers-handify.md (fase 3) e na proposta
-- aprovada pela Jessica em 03/09 ("Ferramentas por Tier · v2").
--
-- Ate aqui a lista de ferramentas era um array hardcoded em FerramentasHub.tsx,
-- sem nenhuma regra alem do login. Agora e uma tabela: a admin decide, sem
-- deploy, o que e gratis, o que abre com qual categoria de curso e o que e
-- exclusivo do Handify Completo.
--
-- Regra de acesso (espelhada em src/lib/ferramentas/access.ts):
--   visitante  → qualquer conta
--   aluna      → membership ativa OU matricula ativa em curso de uma das
--                categorias da ferramenta (sem categoria = qualquer curso)
--   completo   → membership ativa
-- Ferramenta trancada nao some: mostra o `preview` borrado e o caminho.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tool_section') then
    create type public.tool_section as enum ('calcular', 'guardar', 'fornecedores');
  end if;
  if not exists (select 1 from pg_type where typname = 'tool_tier') then
    create type public.tool_tier as enum ('visitante', 'aluna', 'completo');
  end if;
end $$;

create table if not exists public.tools (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  icon         text,
  section      public.tool_section not null default 'calcular',
  min_tier     public.tool_tier not null default 'visitante',
  -- Rota. Aceita {nicho} (slug do nicho principal da aluna) e {nicho_id}.
  href         text,
  coming_soon  boolean not null default false,
  active       boolean not null default true,
  position     int not null default 0,
  -- Linhas de exemplo mostradas borradas quando trancada: [{"label","value"}]
  preview      jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.tools is
  'Ferramentas da area Ferramentas. min_tier + tool_categories decidem quem abre; preview e o que aparece borrado para quem nao tem.';

create table if not exists public.tool_categories (
  tool_id     uuid not null references public.tools(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (tool_id, category_id)
);

comment on table public.tool_categories is
  'Categorias de curso que liberam uma ferramenta de tier "aluna". Sem linha = qualquer curso libera.';

alter table public.tools enable row level security;
alter table public.tool_categories enable row level security;

drop policy if exists "Alunas veem ferramentas ativas" on public.tools;
create policy "Alunas veem ferramentas ativas" on public.tools
  for select to authenticated using (active or public.is_admin());
drop policy if exists "Admin gerencia ferramentas" on public.tools;
create policy "Admin gerencia ferramentas" on public.tools
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Alunas veem categorias das ferramentas" on public.tool_categories;
create policy "Alunas veem categorias das ferramentas" on public.tool_categories
  for select to authenticated using (true);
drop policy if exists "Admin gerencia categorias das ferramentas" on public.tool_categories;
create policy "Admin gerencia categorias das ferramentas" on public.tool_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.tools, public.tool_categories from anon;

-- ─── Seed: as ferramentas de hoje + as aprovadas na proposta ─────────────────
insert into public.tools (slug, name, description, icon, section, min_tier, href, coming_soon, position, preview) values
  ('calculadora-lucro', 'Calculadora de lucro',
   'Custo real e preço ideal de venda — com mão de obra, embalagem e impostos.',
   '🧮', 'calcular', 'visitante', '/ferramentas/calculadora-lucro/{nicho}', false, 10,
   '[{"label":"Vela lavanda 200g","value":"R$ 9,40 / un"},{"label":"Sabonete aveia 90g","value":"R$ 3,15 / un"}]'),
  ('calculadora-essencias', 'Calculadora de essências',
   'Quanto de essência ou óleo essencial na sua receita — em mL, gramas e gotas.',
   '💧', 'calcular', 'aluna', '/ferramentas/calculadora-essencias/{nicho}', false, 20,
   '[{"label":"Sabonete 90g · moderado","value":"1,8 g de essência"},{"label":"Vela 200g · intenso","value":"12 mL"}]'),
  ('calculadora-pavio', 'Qual pavio usar',
   '5 perguntas e o pavio certo para o seu vidro — com alternativas e teste de queima.',
   '🕯️', 'calcular', 'aluna', '/ferramentas/calculadora-pavio', false, 30,
   '[{"label":"Vidro 7 cm · parafina","value":"Pavio CDN 12"},{"label":"Vidro 9 cm · soja","value":"Pavio ECO 14"}]'),
  ('meta-de-renda', 'Meta de renda',
   'Quanto vender, a que preço, para ganhar o que você quer por mês.',
   '🎯', 'calcular', 'visitante', null, true, 40,
   '[{"label":"Meta R$ 2.000/mês","value":"84 unidades"},{"label":"Preço médio","value":"R$ 23,80"}]'),
  ('deu-problema', 'Deu problema?',
   'Afundou, rachou, fez túnel — a causa e como corrigir.',
   '🩺', 'calcular', 'visitante', null, true, 50,
   '[{"label":"Vela afundou no meio","value":"resfriou rápido demais"},{"label":"Fez túnel","value":"pavio fino para o vidro"}]'),
  ('rotulo-sabonete', 'Rótulo do sabonete',
   'O que precisa constar no rótulo — pronto para imprimir.',
   '🔖', 'calcular', 'aluna', null, true, 60,
   '[{"label":"Sabonete aveia 90g","value":"rótulo 6×4 cm"},{"label":"Composição","value":"base glicerinada, aveia…"}]'),
  ('fornecedores', 'Fornecedores',
   'Lojas e materiais escolhidos a dedo, por artesanato.',
   '🏪', 'fornecedores', 'aluna', '/ferramentas/fornecedores?nicho={nicho_id}', false, 10,
   '[{"label":"Base glicerinada 1 kg","value":"3 lojas"},{"label":"Parafina 5 kg","value":"4 lojas"}]'),
  ('minhas-receitas', 'Minhas receitas',
   'Suas receitas com custo calculado, escala de lote e versões.',
   '📒', 'guardar', 'completo', null, true, 10,
   '[{"label":"Vela lavanda 200g","value":"R$ 9,40 / un"},{"label":"Sabonete aveia 90g","value":"R$ 3,15 / un"},{"label":"Vela 3 pavios","value":"R$ 21,80 / un"}]'),
  ('catalogo-precos', 'Catálogo e tabela de preços',
   'Seus produtos com preço — PDF para mandar no WhatsApp.',
   '🏷️', 'guardar', 'completo', null, true, 20,
   '[{"label":"Kit presente 3 velas","value":"R$ 89,00"},{"label":"Sabonete aveia","value":"R$ 12,00"}]'),
  ('pedidos-clientes', 'Pedidos e clientes',
   'Quem pediu, o que, para quando — e quanto tem a receber.',
   '🧾', 'guardar', 'completo', null, true, 30,
   '[{"label":"Ana · 12 sabonetes","value":"entrega sexta"},{"label":"A receber este mês","value":"R$ 1.240"}]'),
  ('estoque', 'Estoque de insumos',
   'Quanto tem de cada material e o que está acabando.',
   '📦', 'guardar', 'completo', null, true, 40,
   '[{"label":"Essência lavanda","value":"40 mL · acabando"},{"label":"Base glicerinada","value":"3,2 kg"}]'),
  ('calendario', 'Calendário do artesanato',
   'Quando começar a produzir para cada data — Natal, Dia das Mães, Páscoa.',
   '📅', 'guardar', 'completo', null, true, 50,
   '[{"label":"Natal","value":"comece em 20 de outubro"},{"label":"Dia das Mães","value":"comece em 1 de abril"}]')
on conflict (slug) do nothing;

-- Categorias que liberam (proposta; a Jessica revisa no painel).
insert into public.tool_categories (tool_id, category_id)
select t.id, c.id
from public.tools t
join public.categories c on c.slug = any (
  case t.slug
    when 'calculadora-essencias' then array['saboaria-artesanal', 'velas-artesanais', 'aromas-e-casa', 'cosmeticos-artesanais']
    when 'calculadora-pavio'     then array['velas-artesanais']
    when 'rotulo-sabonete'       then array['saboaria-artesanal', 'cosmeticos-artesanais']
    else array[]::text[]
  end
)
on conflict do nothing;
