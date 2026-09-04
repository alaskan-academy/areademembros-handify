-- Rotulo passa a cobrir vela tambem: vira "Rotulo do produto" e abre com
-- curso de Velas/Aromas alem de Saboaria/Cosmeticos (a familia dentro da
-- ferramenta segue o curso, como na Validade).
update public.tools
set name = 'Rótulo do produto',
    description = 'Sabonete, cosmético ou vela — o que precisa constar, bonito e pronto para imprimir.',
    icon = '🏷️'
where slug = 'rotulo-sabonete';

insert into public.tool_categories (tool_id, category_id)
select t.id, c.id
from public.tools t
join public.categories c on c.slug = any (array['velas-artesanais', 'aromas-e-casa'])
where t.slug = 'rotulo-sabonete'
on conflict do nothing;
