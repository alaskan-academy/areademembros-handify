-- Meta de renda e Deu problema? saem do "em breve". As duas sao gratuitas
-- (tier visitante): a porta de entrada da area Ferramentas.
update public.tools set coming_soon = false, href = '/ferramentas/meta-de-renda' where slug = 'meta-de-renda';
update public.tools set coming_soon = false, href = '/ferramentas/deu-problema' where slug = 'deu-problema';
