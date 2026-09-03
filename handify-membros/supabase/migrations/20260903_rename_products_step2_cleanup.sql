-- ETAPA 2 de 2 — remove a camada de compatibilidade.
--
-- APLICADA em 03/09/2026, depois do deploy confirmado em produção:
-- webhook da Kiwify respondeu 200 processando 1 curso, tela de erro própria
-- no ar, catálogo público respondendo, e nenhum arquivo do código publicado
-- referenciando os nomes antigos.

drop view if exists public.products;

drop trigger if exists trg_sync_courses_checkout_codes on public.courses;
drop function if exists public.sync_courses_checkout_codes();
alter table public.courses drop column if exists product_codes;

drop trigger if exists trg_sync_banners_checkout_codes on public.banners;
drop function if exists public.sync_banners_checkout_codes();
alter table public.banners drop column if exists product_codes;
