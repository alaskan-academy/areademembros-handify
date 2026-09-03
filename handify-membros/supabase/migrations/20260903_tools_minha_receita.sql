-- "Minha receita": as quatro calculadoras (Lucro, Essências, Pavio, Escala de
-- lote) viram etapas de um fluxo só. Contexto: proposta v2 aprovada em 03/09.
--
-- As três telas antigas continuam existindo (cada etapa abre sozinha, e há
-- links salvos), mas saem da lista do hub: `show_in_hub` separa "existe e
-- tem regra de acesso" (active) de "aparece na lista" (show_in_hub).

alter table public.tools
  add column if not exists show_in_hub boolean not null default true;

comment on column public.tools.show_in_hub is
  'Aparece na lista do hub. false = continua acessível pela rota (com a mesma regra de acesso), só não é listada — caso das etapas de "Minha receita".';

insert into public.tools (slug, name, description, icon, section, min_tier, href, coming_soon, position, preview) values
  ('minha-receita', 'Minha receita',
   'Do ingrediente ao preço, num fluxo só — quanto de essência, qual pavio, quanto custa e por quanto vender.',
   '📒', 'calcular', 'visitante', '/ferramentas/minha-receita', false, 5,
   '[{"label":"Vela lavanda 200g","value":"R$ 9,40 / un"},{"label":"Essência · moderado","value":"12 mL · 240 gotas"},{"label":"Pavio","value":"CDN 12"}]')
on conflict (slug) do nothing;

update public.tools
set show_in_hub = false
where slug in ('calculadora-lucro', 'calculadora-essencias', 'calculadora-pavio');
