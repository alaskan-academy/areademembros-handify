-- Vincula cada curso a um nicho de fornecedores (ex: Velas, Sabonetes)
-- Usado para derivar o filtro de nicho na página de materiais automaticamente via product_course_links

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS niche_id uuid REFERENCES niches(id) ON DELETE SET NULL;
