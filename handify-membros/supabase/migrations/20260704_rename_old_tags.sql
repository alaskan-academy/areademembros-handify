-- Renomear tags antigas (velas → slug da categoria Velas Artesanais,
-- sabonetes → slug da categoria Saboaria Artesanal) em todos os lugares.
-- Usa subquery para pegar os slugs reais da tabela categories.

DO $$
DECLARE
  slug_velas     text;
  slug_sabonetes text;
BEGIN
  SELECT slug INTO slug_velas     FROM categories WHERE name ILIKE 'Velas Artesanais'   LIMIT 1;
  SELECT slug INTO slug_sabonetes FROM categories WHERE name ILIKE 'Saboaria Artesanal' LIMIT 1;

  IF slug_velas IS NULL THEN
    RAISE EXCEPTION 'Categoria "Velas Artesanais" não encontrada na tabela categories';
  END IF;
  IF slug_sabonetes IS NULL THEN
    RAISE EXCEPTION 'Categoria "Saboaria Artesanal" não encontrada na tabela categories';
  END IF;

  -- ── inspiration_posts.tags (array) ────────────────────────────────────────
  -- Substitui 'velas' pelo slug correto em cada array
  UPDATE inspiration_posts
  SET tags = array_replace(tags, 'velas', slug_velas)
  WHERE 'velas' = ANY(tags);

  UPDATE inspiration_posts
  SET tags = array_replace(tags, 'sabonetes', slug_sabonetes)
  WHERE 'sabonetes' = ANY(tags);

  -- ── supplier_tags.tag (coluna de texto) ───────────────────────────────────
  UPDATE supplier_tags SET tag = slug_velas     WHERE tag = 'velas';
  UPDATE supplier_tags SET tag = slug_sabonetes WHERE tag = 'sabonetes';

  RAISE NOTICE 'Tags atualizadas: velas → %, sabonetes → %', slug_velas, slug_sabonetes;
END $$;
