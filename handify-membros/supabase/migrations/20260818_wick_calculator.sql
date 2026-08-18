-- Calculadora de Pavio — tabelas e seed inicial

CREATE TABLE IF NOT EXISTS public.wick_recommendations (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  candle_type      text          NOT NULL CHECK (candle_type IN ('container', 'mold')),
  wax_type         text          NOT NULL,
  diameter_min     numeric(5,1)  NOT NULL,
  diameter_max     numeric(5,1)  NOT NULL,
  fragrance_min    numeric(5,1)  NOT NULL DEFAULT 0,
  fragrance_max    numeric(5,1)  NOT NULL DEFAULT 100,
  has_dye          boolean,       -- NULL = ignora (qualquer)
  mold_shape       text,          -- NULL = ignora (qualquer formato)
  wick_primary     text          NOT NULL,
  wick_alternatives text[]       NOT NULL DEFAULT '{}',
  notes            text,
  course_lesson_id uuid          REFERENCES public.lessons(id) ON DELETE SET NULL,
  priority         integer       NOT NULL DEFAULT 10,
  active           boolean       NOT NULL DEFAULT true,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.wick_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wick_recs_select_auth"
  ON public.wick_recommendations FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

CREATE POLICY "wick_recs_all_admin"
  ON public.wick_recommendations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Fórmulas salvas pelas alunas ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_wick_formulas (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             text          NOT NULL DEFAULT 'Minha Fórmula',
  candle_type      text          NOT NULL CHECK (candle_type IN ('container', 'mold')),
  wax_type         text          NOT NULL,
  diameter         numeric(5,1)  NOT NULL,
  fragrance_pct    numeric(5,1)  NOT NULL,
  has_dye          boolean       NOT NULL DEFAULT false,
  mold_shape       text,
  wick_primary     text          NOT NULL,
  wick_alternatives text[]       NOT NULL DEFAULT '{}',
  test_notes       text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_wick_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_formulas_own"
  ON public.saved_wick_formulas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_formulas_admin"
  ON public.saved_wick_formulas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Seed inicial de recomendações ─────────────────────────────────────────────
-- Valores de diâmetro do picker: 5 | 7.5 | 9.5 | 11.5 | 14
-- Faixas de fragrância (mid): leve=2 | médio=6 | forte=10 | máximo=14

INSERT INTO public.wick_recommendations
  (candle_type, wax_type, diameter_min, diameter_max, fragrance_min, fragrance_max, wick_primary, wick_alternatives, notes, priority)
VALUES
-- ── Recipiente · Cera de Soja ─────────────────────────────────────────────────
('container','soy', 4, 7,   0, 8, 'LX 10', ARRAY['CD 10','ECO 3'],  'Potes pequenos. Chama ideal: 1–1,5 cm. Faça teste de queima de 4h antes de produzir em lote.', 1),
('container','soy', 7, 9,   0, 8, 'LX 14', ARRAY['CD 14','ECO 6'],  'Tamanho de pote mais comum. Piscina de cera completa nas primeiras 2h indica queima saudável.', 1),
('container','soy', 9, 11,  0, 8, 'LX 18', ARRAY['CD 18','ECO 10'], 'Potes médios/grandes. Se a chama ficar alta demais, tente o CD 16 como alternativa.', 1),
('container','soy',11, 13,  0, 8, 'LX 22', ARRAY['CD 20','ECO 12'], 'Para potes acima de 12 cm, considere 2 pavios LX 14 posicionados simetricamente.', 1),
('container','soy',12, 99,  0, 8, 'LX 22 (2 pavios)', ARRAY['2× LX 16','2× CD 18'], '2 pavios são recomendados para garantir queima uniforme em potes grandes.', 1),
-- Soja · Fragrância alta
('container','soy', 4, 7,   8,99, 'LX 8',  ARRAY['CD 8','ECO 2'],  'Fragrância alta retarda a queima — pavio menor compensa. Sempre teste antes de produzir em lote.', 2),
('container','soy', 7, 9,   8,99, 'LX 12', ARRAY['CD 12','ECO 4'], 'Alta carga de fragrância: prefira séries mais finas. Monitore fumaça e temperatura.', 2),
('container','soy', 9, 11,  8,99, 'LX 16', ARRAY['CD 16','ECO 8'], 'Monitore a temperatura da cera líquida durante o teste de queima.', 2),
('container','soy',11, 99,  8,99, 'LX 20', ARRAY['CD 18'],         'Considere 2 pavios LX 10 para potes muito grandes com alta fragrância.', 2),
-- ── Recipiente · Parafina ─────────────────────────────────────────────────────
('container','paraffin', 4, 7,  0, 8, 'LX 8',  ARRAY['CD 8'],  'Parafina queima mais quente — pavio menor que soja no mesmo diâmetro. Fumaça preta = pavio grande demais.', 1),
('container','paraffin', 7, 9,  0, 8, 'LX 12', ARRAY['CD 12'], 'Verifique ausência de fumaça preta — indica pavio inadequado.', 1),
('container','paraffin', 9, 11, 0, 8, 'LX 16', ARRAY['CD 16'], 'Parafina forma piscina mais rapidamente. Chama ideal: 1–2 cm.', 1),
('container','paraffin',11, 99, 0, 8, 'LX 20', ARRAY['CD 18'], 'Para potes grandes de parafina, 2 pavios LX 12 são boa alternativa.', 1),
-- Parafina · Fragrância alta
('container','paraffin', 4, 7,  8,99, 'LX 6',  ARRAY['CD 6'],  'Com alta fragrância e parafina, desça um tamanho do usual.', 2),
('container','paraffin', 7, 9,  8,99, 'LX 10', ARRAY['CD 10'], null, 2),
('container','paraffin', 9, 11, 8,99, 'LX 14', ARRAY['CD 14'], null, 2),
('container','paraffin',11, 99, 8,99, 'LX 18', ARRAY['CD 16'], null, 2),
-- ── Recipiente · Cera de Coco ─────────────────────────────────────────────────
('container','coconut', 4, 7,  0,10, 'LX 10', ARRAY['ECO 3'],  'Cera de coco tem ponto de fusão baixo e queima suave — comportamento similar à soja.', 1),
('container','coconut', 7, 9,  0,10, 'LX 14', ARRAY['ECO 6'],  null, 1),
('container','coconut', 9, 11, 0,10, 'LX 18', ARRAY['ECO 10'], null, 1),
('container','coconut',11, 99, 0,10, 'LX 22', ARRAY['ECO 12'], null, 1),
-- ── Recipiente · Blend ────────────────────────────────────────────────────────
('container','blend', 4, 7,  0,10, 'LX 10', ARRAY['CD 10','ECO 3'],  'Blends variam muito por formulação — use estes como ponto de partida e ajuste com testes.', 1),
('container','blend', 7, 9,  0,10, 'LX 14', ARRAY['CD 14','ECO 6'],  null, 1),
('container','blend', 9, 11, 0,10, 'LX 18', ARRAY['CD 16','ECO 8'],  null, 1),
('container','blend',11, 99, 0,10, 'LX 22', ARRAY['CD 20'],          null, 1),
-- ── Recipiente · Cera de Abelha ───────────────────────────────────────────────
('container','beeswax', 4, 7,  0,6, 'CD 6',  ARRAY['ECO 2'], 'Cera de abelha queima diferente — pavios de algodão são preferíveis. Menos fragrância é recomendado.', 1),
('container','beeswax', 7, 9,  0,6, 'CD 10', ARRAY['ECO 4'], null, 1),
('container','beeswax', 9, 99, 0,6, 'CD 14', ARRAY['ECO 6'], null, 1),
-- ── Molde · Parafina pilar ────────────────────────────────────────────────────
('mold','pillar_paraffin', 4, 7,  0,6, 'Pavio quadrado nº 2', ARRAY['ECO 10','LX 12'], 'Pavios quadrados trançados são os mais indicados para pilar. Centralize bem no molde antes de verter.', 1),
('mold','pillar_paraffin', 7, 9,  0,6, 'Pavio quadrado nº 3', ARRAY['ECO 14','LX 16'], 'Moldes maiores precisam de pavios mais robustos para atingir o núcleo.', 1),
('mold','pillar_paraffin', 9, 99, 0,6, 'Pavio quadrado nº 4', ARRAY['ECO 18'],          'Para moldes grandes, pré-aqueça levemente o molde antes de verter para evitar furos internos.', 1),
-- ── Molde · Soja pilar ────────────────────────────────────────────────────────
('mold','soy', 4, 7,  0,6, 'ECO 6',  ARRAY['LX 12'], 'Use cera de soja formulada para pilar (não container) — verifique a especificação do fabricante.', 1),
('mold','soy', 7, 9,  0,6, 'ECO 10', ARRAY['LX 16'], null, 1),
('mold','soy', 9, 99, 0,6, 'ECO 14', ARRAY['LX 20'], null, 1),
-- ── Molde · Blend pilar ───────────────────────────────────────────────────────
('mold','blend', 4, 7,  0,8, 'Pavio quadrado nº 2', ARRAY['ECO 8'],  'Blends para pilar geralmente têm maior ponto de fusão — consulte as especificações do seu blend.', 1),
('mold','blend', 7, 9,  0,8, 'Pavio quadrado nº 3', ARRAY['ECO 12'], null, 1),
('mold','blend', 9, 99, 0,8, 'Pavio quadrado nº 4', ARRAY['ECO 16'], null, 1);
