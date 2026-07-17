-- Favoritos de produtos
CREATE TABLE IF NOT EXISTS product_favorites (
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- Comentários/avaliações de produtos (com moderação admin)
CREATE TABLE IF NOT EXISTS product_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
  approved   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_approved
  ON product_reviews (product_id, approved);

CREATE INDEX IF NOT EXISTS idx_product_favorites_user
  ON product_favorites (user_id);

-- RLS
ALTER TABLE product_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews   ENABLE ROW LEVEL SECURITY;

-- product_favorites — cada aluna gerencia os próprios
CREATE POLICY "Alunas gerenciam próprios favoritos de produtos"
  ON product_favorites FOR ALL
  USING (user_id = auth.uid());

-- product_reviews — alunas veem aprovados; inserem e editam os próprios; admin gerencia tudo
CREATE POLICY "Alunas veem comentários de produto aprovados"
  ON product_reviews FOR SELECT
  USING (approved = true AND auth.role() = 'authenticated');

CREATE POLICY "Alunas inserem próprio comentário de produto"
  ON product_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "Alunas atualizam próprio comentário de produto"
  ON product_reviews FOR UPDATE
  USING (user_id = auth.uid() AND NOT approved);

CREATE POLICY "Admins gerenciam comentários de produto"
  ON product_reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
