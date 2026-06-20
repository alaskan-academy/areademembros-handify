-- ============================================================
-- SEED DE DEMONSTRAÇÃO — Handify Área de Membros
-- Rodar no Supabase Dashboard → SQL Editor
-- ============================================================

-- Categorias
INSERT INTO categories (id, name, slug) VALUES
  ('00000001-0000-0000-0000-000000000001', 'Crochê',  'croche'),
  ('00000001-0000-0000-0000-000000000002', 'Tricô',   'trico'),
  ('00000001-0000-0000-0000-000000000003', 'Macramê', 'macrame')
ON CONFLICT (id) DO NOTHING;

-- ── Curso 1: Crochê ──────────────────────────────────────────
INSERT INTO courses (id, slug, title, description, thumbnail_url, category_id, price, product_code, workload_hours, is_subscription_only, published, position)
VALUES (
  '00000002-0000-0000-0000-000000000001',
  'croche-basico-ao-avancado',
  'Crochê: Do Básico ao Avançado',
  'Aprenda crochê do zero e evolua até técnicas avançadas. Você vai dominar os pontos essenciais, criar peças incríveis e desenvolver seu próprio estilo. Ideal para iniciantes e para quem quer aperfeiçoar a técnica.',
  'https://images.unsplash.com/photo-1604176424473-17e36ac27e57?w=800&q=80',
  '00000001-0000-0000-0000-000000000001',
  197.00,
  'CROCHE-BASICO-01',
  12,
  false,
  true,
  1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO modules (id, course_id, title, position) VALUES
  ('00000003-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 'Introdução ao Crochê', 1),
  ('00000003-0000-0000-0000-000000000002', '00000002-0000-0000-0000-000000000001', 'Pontos Básicos',       2),
  ('00000003-0000-0000-0000-000000000003', '00000002-0000-0000-0000-000000000001', 'Projeto Final',        3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, video_panda_id, duration_seconds, is_preview, position) VALUES
  ('00000004-0000-0000-0000-000000000001', '00000003-0000-0000-0000-000000000001', 'Bem-vinda ao curso',            'demo-001', 420,  true,  1),
  ('00000004-0000-0000-0000-000000000002', '00000003-0000-0000-0000-000000000001', 'Materiais necessários',          'demo-002', 600,  false, 2),
  ('00000004-0000-0000-0000-000000000003', '00000003-0000-0000-0000-000000000001', 'Como segurar a agulha e o fio', 'demo-003', 780,  false, 3),
  ('00000004-0000-0000-0000-000000000004', '00000003-0000-0000-0000-000000000002', 'Ponto baixo',                   'demo-004', 900,  true,  1),
  ('00000004-0000-0000-0000-000000000005', '00000003-0000-0000-0000-000000000002', 'Ponto alto',                    'demo-005', 840,  false, 2),
  ('00000004-0000-0000-0000-000000000006', '00000003-0000-0000-0000-000000000002', 'Aumentos e diminuições',        'demo-006', 1020, false, 3),
  ('00000004-0000-0000-0000-000000000007', '00000003-0000-0000-0000-000000000002', 'Leitura de gráficos',           'demo-007', 720,  false, 4),
  ('00000004-0000-0000-0000-000000000008', '00000003-0000-0000-0000-000000000003', 'Bolsa de crochê: moldura',      'demo-008', 1200, false, 1),
  ('00000004-0000-0000-0000-000000000009', '00000003-0000-0000-0000-000000000003', 'Bolsa de crochê: montagem',     'demo-009', 1500, false, 2),
  ('00000004-0000-0000-0000-000000000010', '00000003-0000-0000-0000-000000000003', 'Finalização e acabamentos',     'demo-010', 660,  false, 3)
ON CONFLICT (id) DO NOTHING;

-- ── Curso 2: Macramê ─────────────────────────────────────────
INSERT INTO courses (id, slug, title, description, thumbnail_url, category_id, price, product_code, workload_hours, is_subscription_only, published, position)
VALUES (
  '00000002-0000-0000-0000-000000000002',
  'macrame-decoracao',
  'Macramê para Decoração',
  'Crie peças únicas de macramê para decorar sua casa ou vender. Aprenda nós, técnicas e composições com fios de algodão — painéis, porta-vasos, mandalas e muito mais.',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  '00000001-0000-0000-0000-000000000003',
  147.00,
  'MACRAME-DECO-01',
  8,
  false,
  true,
  2
) ON CONFLICT (id) DO NOTHING;

INSERT INTO modules (id, course_id, title, position) VALUES
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000002', 'Fundamentos do Macramê', 1),
  ('00000003-0000-0000-0000-000000000005', '00000002-0000-0000-0000-000000000002', 'Peças para Casa',        2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, video_panda_id, duration_seconds, is_preview, position) VALUES
  ('00000004-0000-0000-0000-000000000011', '00000003-0000-0000-0000-000000000004', 'História e materiais',        'demo-101', 480,  true,  1),
  ('00000004-0000-0000-0000-000000000012', '00000003-0000-0000-0000-000000000004', 'Nó quadrado e espiralado',    'demo-102', 720,  false, 2),
  ('00000004-0000-0000-0000-000000000013', '00000003-0000-0000-0000-000000000004', 'Painel decorativo básico',    'demo-103', 1080, false, 3),
  ('00000004-0000-0000-0000-000000000014', '00000003-0000-0000-0000-000000000005', 'Porta-vasos de parede',       'demo-104', 1320, true,  1),
  ('00000004-0000-0000-0000-000000000015', '00000003-0000-0000-0000-000000000005', 'Mandala com fio',             'demo-105', 1560, false, 2)
ON CONFLICT (id) DO NOTHING;

-- ── Curso 3: Tricô (assinatura) ──────────────────────────────
INSERT INTO courses (id, slug, title, description, thumbnail_url, category_id, price, product_code, workload_hours, is_subscription_only, published, position)
VALUES (
  '00000002-0000-0000-0000-000000000003',
  'trico-agulhas-circulares',
  'Tricô com Agulhas Circulares',
  'Domine as agulhas circulares e crie peças tubulares, gorros, meias e muito mais. Um curso completo para quem quer expandir seus horizontes no tricô moderno.',
  'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&q=80',
  '00000001-0000-0000-0000-000000000002',
  167.00,
  'TRICO-CIRC-01',
  10,
  true,
  true,
  3
) ON CONFLICT (id) DO NOTHING;

INSERT INTO modules (id, course_id, title, position) VALUES
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000003', 'Introdução ao Tricô Circular', 1),
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000003', 'Projetos Práticos',            2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, video_panda_id, duration_seconds, is_preview, position) VALUES
  ('00000004-0000-0000-0000-000000000016', '00000003-0000-0000-0000-000000000006', 'Agulhas circulares: tipos e usos', 'demo-201', 540,  true,  1),
  ('00000004-0000-0000-0000-000000000017', '00000003-0000-0000-0000-000000000006', 'Montar pontos em circular',        'demo-202', 900,  false, 2),
  ('00000004-0000-0000-0000-000000000018', '00000003-0000-0000-0000-000000000007', 'Gorro básico',                     'demo-203', 1800, true,  1),
  ('00000004-0000-0000-0000-000000000019', '00000003-0000-0000-0000-000000000007', 'Meias de tricô',                   'demo-204', 2100, false, 2)
ON CONFLICT (id) DO NOTHING;

-- ── Enrollment de demonstração ────────────────────────────────
-- Para se matricular no curso de Crochê e ver como fica com acesso:
-- 1. Rode primeiro: SELECT id FROM auth.users LIMIT 5;
-- 2. Copie seu user_id e substitua abaixo, depois rode:
--
-- INSERT INTO enrollments (user_id, course_id, source, granted_at)
-- VALUES ('SEU-USER-ID-AQUI', '00000002-0000-0000-0000-000000000001', 'manual', now())
-- ON CONFLICT DO NOTHING;
