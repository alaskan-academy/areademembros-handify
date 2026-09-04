-- Validade do produto — quanto tempo dura o que ela fez, o que limita, e o
-- texto pronto para o rotulo. Contexto em .claude/plans/tiers-handify.md
-- ("Proposta — Validade do produto").
--
-- Tier aluna: e conhecimento que o curso ensina e tem risco se usado sem base
-- (agua sem conservante). Libera com curso de Saboaria, Cosmeticos, Velas ou
-- Aromas — a Jessica revisa no painel Ferramentas e tiers.

insert into public.tools (slug, name, description, icon, section, min_tier, href, coming_soon, position, preview)
select
  'validade-produto', 'Validade do produto',
  'Quanto tempo dura o que você fez, o que limita — e o texto pronto para o rótulo.',
  '⏳', 'calcular', 'aluna', '/ferramentas/validade', false, 35,
  '[{"label":"Glicerinado embalado","value":"12 meses"},{"label":"Hidratante sem conservante","value":"7 dias — cuidado"}]'::jsonb
where not exists (select 1 from public.tools where slug = 'validade-produto');

insert into public.tool_categories (tool_id, category_id)
select t.id, c.id
from public.tools t
join public.categories c on c.slug = any (array['saboaria-artesanal', 'cosmeticos-artesanais', 'velas-artesanais', 'aromas-e-casa'])
where t.slug = 'validade-produto'
on conflict do nothing;
