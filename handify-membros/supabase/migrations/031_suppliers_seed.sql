-- ── Seed de fornecedores de velas ────────────────────────────────────────────
-- Rodar apenas uma vez; usa ON CONFLICT DO NOTHING para idempotência.

DO $$
DECLARE v uuid;
BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. Tudo para Velas
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Tudo para Velas',
  'Uma das lojas mais completas do Brasil para quem produz velas artesanais. Oferece ceras vegetais e parafinas, essências, pavios, moldes, corantes, potes de vidro, latas decorativas e embalagens — tudo em um só lugar.',
  true, true, 1
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.tudoparavelas.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/tudoparavelas/'),
  (v, 'shopee',       'https://shopee.com.br/tudoparavelas'),
  (v, 'mercadolivre', 'https://lista.mercadolivre.com.br/_CustId_706322100_PrCategId_AD');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'essencias'),(v,'ceras'),(v,'pavios'),(v,'moldes'),
  (v,'corantes'),(v,'embalagens'),(v,'vidros');

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. Peter Paiva
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Peter Paiva',
  'Matérias-primas de alta qualidade para velas e sabonetes artesanais: essências aromáticas selecionadas, vidros jateados, ceras e kits completos para quem quer criar e vender.',
  true, true, 2
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.lojapeterpaiva.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/peterpaiva');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'vidros'),(v,'insumos');

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. Ponto Química
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Ponto Química',
  'Especialista em ceras vegetais (coco, soja, abelha) e parafinas, além de bases glicerinadas, potes e pavios para fabricação de velas e sabonetes artesanais.',
  true, true, 3
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.pontoquimica.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/pontoquimicabr/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'ceras'),(v,'pavios'),(v,'moldes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. Thomsen
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Thomsen',
  'Catálogo completo para velas aromáticas: ceras e parafinas, pavios de madeira e trançados, essências premium, corantes, potes de vidro, latas decorativas, tampas e embalagens diversas.',
  true, true, 4
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.thomsen.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/velaearoma/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'essencias'),(v,'ceras'),(v,'pavios'),(v,'corantes'),
  (v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 05. Catarina Velas
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Catarina Velas',
  'Insumos completos para quem produz velas artesanais: ceras vegetais, parafinas, essências lipo e hidrossolúveis, pavios de algodão e madeira, moldes de silicone, corantes, micas, embalagens e kits para iniciantes.',
  true, true, 5
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.catarinavelas.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/catarinavelasrj'),
  (v, 'shopee',       'https://shopee.com.br/catarina_velas'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/pagina/catarinavelas');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'essencias'),(v,'ceras'),(v,'pavios'),(v,'moldes'),
  (v,'corantes'),(v,'embalagens'),(v,'vidros');

-- ─────────────────────────────────────────────────────────────────────────────
-- 06. ATR Essências
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'ATR Essências',
  'Loja completa em insumos para velas e sabonetes: ceras de coco e soja, parafinas, pavios, moldes de vidro, corantes em pó e essências hidrossolúveis e lipossolúveis de alta concentração.',
  true, true, 6
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.atressencias.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/atressencias'),
  (v, 'shopee',       'https://shopee.com.br/atressencias'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/atr-essencias');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'ceras'),(v,'pavios'),
  (v,'moldes'),(v,'corantes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 07. Vaporo
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Vaporo',
  'Especializada em materiais para velas e perfumaria artesanal: essências aromáticas, ceras vegetais, pavios, moldes, corantes, micas e bases para aromatizadores.',
  true, true, 7
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.vaporo.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/vaporo.essencias/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'essencias'),(v,'ceras'),(v,'pavios'),(v,'moldes'),(v,'corantes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 08. São Vitor Pavios
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'São Vitor Pavios',
  'Referência em pavios para velas: pavios comuns, mágicos, de madeira e para velas religiosas, além de ilhós, anilina e corantes em pó para complementar sua produção.',
  true, true, 8
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.saovitor.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/saovitorwicks/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'pavios'),(v,'insumos');

-- ─────────────────────────────────────────────────────────────────────────────
-- 09. Cantinho das Essências
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Cantinho das Essências',
  'Essências, bases cosméticas e matérias-primas para velas, sabonetes e aromaterapia, com moldes de silicone, embalagens e itens decorativos para personalizar seus produtos.',
  true, true, 9
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.cantinhodasessencias.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/cantinhodasessencias/'),
  (v, 'shopee',    'https://shopee.com.br/cantinhodasessencias');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'moldes'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Big Fonte das Essências
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Big Fonte das Essências',
  'Essências, ceras e matérias-primas para velas, perfumes e sabonetes artesanais, com frascos e tampas para embalagem final dos seus produtos.',
  true, true, 10
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://bigfontedasessencias.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/bigfontedasessencias/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'ceras'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Big Essências
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Big Essências',
  'Essências premium inspiradas em perfumes de luxo internacionais, além de frascos, tampas e insumos para criar velas aromáticas, difusores e cosméticos personalizados.',
  true, true, 11
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.bigessencias.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/bigessencias/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'essencias'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Click Ceras
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Click Ceras',
  'Especializada em insumos para velas artesanais: cera de coco, parafina, pavios, essências, corantes, potes e kits completos para quem está começando ou quer escalar a produção.',
  true, true, 12
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.clickceras.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/click_ceras/'),
  (v, 'shopee',       'https://shopee.com.br/clickceras'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/click-ceras');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'essencias'),(v,'ceras'),(v,'pavios'),(v,'corantes'),(v,'moldes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Ohana Químicos
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Ohana Químicos',
  'Resinas epóxi, pigmentos coloridos, borracha de silicone, moldes de silicone e ceras para velas decorativas — ótima opção para quem trabalha com artesanato criativo em resina e velas.',
  true, true, 13
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.ohanaquimicos.com/'),
  (v, 'instagram',    'https://www.instagram.com/ohanaquimicos'),
  (v, 'shopee',       'https://shopee.com.br/ohanaa1'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/pagina/ohanacomposites');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'moldes'),(v,'quimicos'),(v,'corantes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Solven Solventes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Solven Solventes',
  'Distribuidora com mais de 30 anos no mercado, especializada em parafinas, solventes ecológicos, óleos e adjuvantes — referência em matéria-prima para produção de velas em maior escala.',
  true, true, 14
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://solven.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/solvensq/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'ceras'),(v,'quimicos');

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. JS Ribeiro – Casa do Artesão
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'JS Ribeiro – Casa do Artesão',
  'Distribuidora das essências Vollmens, ceras vegetais, pavios, corantes, moldes de silicone, embalagens (vidros, latinhas, caixas) e bases cosméticas para velas e artesanato de perfumaria.',
  true, true, 15
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://jsribeiro.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/JSCASADOARTESAO');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'ceras'),(v,'pavios'),
  (v,'corantes'),(v,'moldes'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. Rinem
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Rinem',
  'Distribuidora de produtos químicos industriais desde 1990, com portfólio voltado a fragrâncias, cosméticos e saneantes — boa opção para compras em maior volume.',
  false, true, 16
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://rinen.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/rinenindustria/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'quimicos'),(v,'insumos');

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. Império do Banho
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Império do Banho',
  'Insumos completos para velas e sabonetes artesanais: ceras, parafinas, pavios, essências, moldes de silicone, óleos vegetais e embalagens para quem produz em casa ou em escala.',
  true, true, 17
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.imperiodobanho.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/imperiodobanho/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'ceras'),(v,'pavios'),
  (v,'moldes'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. Kyart Velas e Moldes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Kyart Velas e Moldes',
  'Especialista em moldes de silicone para velas e sabonetes artesanais, com grande variedade de formas e modelos para criar peças diferenciadas.',
  true, true, 18
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.kyartvelasemoldes.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/kyartmoldes/'),
  (v, 'shopee',    'https://shopee.com.br/kyartmoldesdesilicone');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'moldes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. Império das Essências
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Império das Essências',
  'Essências concentradas, bases, moldes de silicone e embalagens para velas, sabonetes e aromatizadores — atende tanto artesãs iniciantes quanto produtoras experientes.',
  true, true, 19
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.imperiodasessencias.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/imperiodasessenciasoficial'),
  (v, 'shopee',       'https://shopee.com.br/imperiodasessencias'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/imperio-das-essencias');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'essencias'),(v,'moldes'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. Duaroma Embalagens
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Duaroma Embalagens',
  'Potes e copos de vidro para velas aromáticas (estilo whisky e geleinha) em diferentes tamanhos, com tampas de madeira pinus e acabamentos variados para uma apresentação elegante.',
  true, true, 20
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.duaromaembalagens.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/duaromaembalagens/'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/duaroma');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. Embavidro
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Embavidro',
  'Embalagens de vidro de alta qualidade com mais de 31 anos de mercado, atendendo artesãs, cosméticos, alimentos e farmácias com potes e frascos em variados formatos.',
  true, true, 21
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://embavidro.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/embavidroembalagens/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. Dual Vidros
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Dual Vidros',
  'Potes e embalagens de vidro sustentáveis para velas e produtos artesanais: frascos difusores, garrafas, rolhas de cortiça, tampas e lacres termoencolhíveis para um acabamento profissional.',
  true, true, 22
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://loja.dualembalagensdevidro.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/dualvidros');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. Olympia Embalagens
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Olympia Embalagens',
  'Distribuidora criativa com latas decorativas (mandala, premium, metalizadas), cerâmica chinesa, potes de vidro, cera de coco (Solven), essências (Vollmens) e corantes para velas artesanais.',
  true, true, 23
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.olympiaembalagens.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/olympia.embalagens'),
  (v, 'shopee',    'https://shopee.com.br/olympia.emb');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'ceras'),(v,'essencias'),(v,'embalagens'),(v,'vidros'),(v,'corantes');

-- ─────────────────────────────────────────────────────────────────────────────
-- 24. Artesanato DDD
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Artesanato DDD',
  'Potes, copos e recipientes de vidro em variados tamanhos para velas artesanais, além de velas decorativas, cilíndricas e flutuantes prontas para revenda.',
  true, true, 24
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.artesanatoddd.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/artesanatoddd'),
  (v, 'shopee',    'https://shopee.com.br/artesanatoddd');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 25. Pires Embalagens
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Pires Embalagens',
  'Mais de 2.000 itens em embalagens para cosméticos, farmácia e artesanato: frascos de vidro, potes plásticos, bisnagas e recipientes em variados formatos e tamanhos.',
  true, true, 25
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.lojapiresembalagens.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/piresembalagens'),
  (v, 'shopee',    'https://shopee.com.br/piresembalagens10');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 26. Caixas Net
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Caixas Net',
  'Primeira loja virtual de embalagens de papelão do Brasil: caixas para envio, presentes e e-commerce, sacolas de papel, envelopes e acessórios para embalar seus produtos com segurança.',
  true, true, 26
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.caixasnet.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/caixasnet');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 27. Ekopak
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Ekopak',
  'Embalagens de vidro com foco em sustentabilidade: potes para conservas, geleias, azeites e produtos artesanais, com grande variedade de formatos e capacidades.',
  true, true, 27
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.ekopak.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/ekopak_br/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'vidros'),(v,'embalagens');

-- ─────────────────────────────────────────────────────────────────────────────
-- 28. Printi
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Printi',
  'Gráfica online para quem quer profissionalizar a marca: rótulos personalizados, adesivos, cartões de visita, embalagens impressas e flyers com entrega em todo o Brasil.',
  true, true, 28
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.printi.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/printibr/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'impressao'),(v,'etiquetas');

-- ─────────────────────────────────────────────────────────────────────────────
-- 29. 360imprimir
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  '360imprimir',
  'Plataforma de impressão online com produtos promocionais personalizados: adesivos, rótulos, cartões de visita, vestuário e papelaria para dar identidade visual ao seu negócio.',
  true, true, 29
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.360imprimir.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/360imprimir_br/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'impressao'),(v,'etiquetas');

-- ─────────────────────────────────────────────────────────────────────────────
-- 30. Adeconex
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Adeconex',
  'Especialista em etiquetas adesivas e fitas de cetim personalizadas, ribbons para impressoras térmicas e impressoras de etiquetas — ideal para rotular e identificar seus produtos artesanais.',
  true, true, 30
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',      'https://www.adeconex.com.br/'),
  (v, 'instagram',    'https://www.instagram.com/adeconex'),
  (v, 'shopee',       'https://shopee.com.br/adeconex'),
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/adeconex');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'etiquetas');

-- ─────────────────────────────────────────────────────────────────────────────
-- 31. TSC Auto ID Brasil
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'TSC Auto ID Brasil',
  'Fabricante de impressoras térmicas para etiquetas (desktop, industrial e RFID) com suprimentos e softwares — para quem quer imprimir etiquetas profissionais com volume e qualidade.',
  false, true, 31
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://latam.tscprinters.com/'),
  (v, 'instagram', 'https://www.instagram.com/tscautoidbr/');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'etiquetas');

-- ─────────────────────────────────────────────────────────────────────────────
-- 32. Niimbot
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Niimbot',
  'Impressoras de etiquetas portáteis e inteligentes para rotular produtos artesanais: modelos compactos com conectividade Bluetooth e rolos de etiquetas em diversos materiais e tamanhos.',
  true, true, 32
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'website',   'https://www.niimbot.com.br/'),
  (v, 'instagram', 'https://www.instagram.com/niimbot'),
  (v, 'shopee',    'https://shopee.com.br/niimbot_mall.br');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'etiquetas');

-- ─────────────────────────────────────────────────────────────────────────────
-- Lojas exclusivas de Shopee (sem site próprio cadastrado)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'E-Commerce do Artesanato',
  'Loja na Shopee com variedade de insumos e materiais para artesanato de velas e produção criativa.',
  false, true, 33
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'shopee', 'https://shopee.com.br/e.commerce65');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Loja Frandaluli',
  'Insumos e acessórios para artesanato de velas com bom custo-benefício na Shopee.',
  false, true, 34
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'shopee', 'https://shopee.com.br/lojafrandaluli');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'FPM Soluções',
  'Utensílios e materiais para artesanato de velas e decoração na Shopee.',
  false, true, 35
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'shopee', 'https://shopee.com.br/fpm_utilidades');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Império dos Moldes',
  'Moldes de silicone para velas artesanais em grande variedade de formatos e modelos na Shopee.',
  false, true, 36
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'shopee', 'https://shopee.com.br/angela.simone');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'moldes');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Conteúdo Artesanal',
  'Materiais e insumos para artesanato de velas com ótimas avaliações na Shopee.',
  false, true, 37
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'shopee', 'https://shopee.com.br/daianemichelle1808');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'BCM Oficial',
  'Materiais e insumos para artesanato e fabricação de velas na Shopee.',
  false, true, 38
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'shopee', 'https://shopee.com.br/bcmoficial');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

-- ─────────────────────────────────────────────────────────────────────────────
-- Lojas exclusivas do Mercado Livre
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Lumina Aura',
  'Insumos e materiais para velas artesanais no Mercado Livre, com boas avaliações e entrega rápida.',
  false, true, 39
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/pagina/luminaaura');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Velas Sorocaba',
  'Fornecedora de insumos para velas artesanais e velas prontas para revenda, com entrega nacional pelo Mercado Livre.',
  false, true, 40
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/velas-sorocaba');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'insumos');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'IB Moldes',
  'Moldes de silicone para velas e artesanato com variedade de formas e modelos no Mercado Livre.',
  false, true, 41
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/pagina/ibmoldes');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'moldes');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Evolux Digital',
  'Soluções em impressão digital, etiquetas e rótulos personalizados para identificar produtos artesanais com profissionalismo.',
  false, true, 42
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/pagina/evoluxdigital');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'etiquetas'),(v,'impressao');

INSERT INTO suppliers (name, description, verified, active, position)
VALUES (
  'Artegrafix',
  'Rótulos, etiquetas e materiais gráficos personalizados para identificação de velas, sabonetes e produtos artesanais no Mercado Livre.',
  false, true, 43
) RETURNING id INTO v;
INSERT INTO supplier_channels (supplier_id, channel, url) VALUES
  (v, 'mercadolivre', 'https://www.mercadolivre.com.br/loja/artegrafix');
INSERT INTO supplier_tags (supplier_id, tag) VALUES
  (v,'velas'),(v,'sabonetes'),(v,'etiquetas'),(v,'impressao');

END $$;
