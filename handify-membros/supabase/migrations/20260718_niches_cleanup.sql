-- Remove nichos sem cursos correspondentes no catálogo.
-- Aromaterapia e Embalagens foram criados para o módulo de fornecedores
-- mas não há (e não está previsto) cursos nessas categorias.
-- O filtro de fornecedores deriva o nicho via product_course_links → courses.niche_id,
-- então manter nichos sem cursos só poluía o seletor no admin.
DELETE FROM niches WHERE slug IN ('aromaterapia', 'embalagens');
