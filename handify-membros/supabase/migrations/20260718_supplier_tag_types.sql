-- Tabela de tipos de tag de fornecedores — gerenciável pelo admin sem deploy.
-- Antes as tags eram hardcoded em CATEGORY_TAGS no código.

CREATE TABLE IF NOT EXISTS supplier_tag_types (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug     text NOT NULL UNIQUE,
  label    text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

ALTER TABLE supplier_tag_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica" ON supplier_tag_types FOR SELECT USING (true);
CREATE POLICY "admin gerencia" ON supplier_tag_types FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO supplier_tag_types (slug, label, position) VALUES
  ('essencias',  'Essências',             1),
  ('ceras',      'Ceras / Bases',         2),
  ('pavios',     'Pavios',                3),
  ('moldes',     'Moldes',                4),
  ('corantes',   'Corantes',              5),
  ('embalagens', 'Embalagens',            6),
  ('vidros',     'Potes de Vidro',        7),
  ('etiquetas',  'Etiquetas',             8),
  ('impressao',  'Gráfica / Impressão',   9),
  ('quimicos',   'Aditivos / Químicos',  10),
  ('insumos',    'Insumos Gerais',       11)
ON CONFLICT (slug) DO NOTHING;
