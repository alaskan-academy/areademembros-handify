-- Migra as tags de nicho dos fornecedores para supplier_niche_links.
-- Antes: tag "velas-artesanais" e "saboaria-artesanal" em supplier_tags identificavam o nicho.
-- Depois: supplier_niche_links é a fonte de verdade; tags ficam só para produtos oferecidos.

INSERT INTO supplier_niche_links (supplier_id, niche_id)
SELECT DISTINCT st.supplier_id, n.id
FROM supplier_tags st
JOIN niches n ON n.slug = 'velas-artesanais'
WHERE st.tag = 'velas-artesanais'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_niche_links (supplier_id, niche_id)
SELECT DISTINCT st.supplier_id, n.id
FROM supplier_tags st
JOIN niches n ON n.slug = 'saboaria-artesanal'
WHERE st.tag = 'saboaria-artesanal'
ON CONFLICT DO NOTHING;

DELETE FROM supplier_tags WHERE tag IN ('velas-artesanais', 'saboaria-artesanal');
