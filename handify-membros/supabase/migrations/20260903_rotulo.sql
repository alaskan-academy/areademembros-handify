-- Rotulo do sabonete sai do "em breve": /ferramentas/rotulo.
-- Tier aluna, categorias Saboaria e Cosmeticos (ja em tool_categories).
update public.tools
set coming_soon = false, href = '/ferramentas/rotulo'
where slug = 'rotulo-sabonete';
