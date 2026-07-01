-- ── Sabonetes: adicionar tag + novos fornecedores ────────────────────────────
-- Idempotente: ON CONFLICT DO NOTHING em todos os inserts de tags.

DO $$
DECLARE v uuid;
BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Adicionar tag sabonetes em fornecedores que só tinham velas
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Tudo para Velas'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Vaporo'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Big Essências'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Rinem'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'E-Commerce do Artesanato'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Loja Frandaluli'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'FPM Soluções'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Império dos Moldes'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Conteúdo Artesanal'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'BCM Oficial'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Lumina Aura'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'Velas Sorocaba'
ON CONFLICT DO NOTHING;

INSERT INTO supplier_tags (supplier_id, tag)
SELECT id, 'sabonetes' FROM suppliers WHERE name = 'IB Moldes'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Lojas Linna — novo fornecedor exclusivo sabonetes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Lojas Linna',
  'Especializada em insumos e bases para sabonetes artesanais: bases glicerinadas, óleos vegetais, essências, corantes, moldes de silicone e embalagens para quem produz sabonetes em casa ou em escala.',
  true, true, 44
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.lojaslinna.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/lojaslinna');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'sabonetes'),(v,'essencias'),(v,'moldes'),(v,'insumos'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Linne Cosméticos — novo fornecedor exclusivo sabonetes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Linne Cosméticos',
  'Matérias-primas cosméticas para sabonetes artesanais: bases, ativos, óleos essenciais, corantes, fragrâncias e embalagens — voltada para quem quer elevar a qualidade dos produtos.',
  true, true, 45
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.limne.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/limne_cosmeticos/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'sabonetes'),(v,'essencias'),(v,'corantes'),(v,'insumos'),(v,'quimicos');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Nandê Botânica — nova loja ML, sabonetes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Nandê Botânica',
  'Loja no Mercado Livre com insumos naturais e botânicos para sabonetes artesanais: óleos vegetais, essências, ativos naturais e matérias-primas para cosméticos.',
  false, true, 46
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/pagina/nandebotanica');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'sabonetes'),(v,'essencias'),(v,'insumos');

END $$;
