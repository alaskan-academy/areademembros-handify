-- Adiciona suporte a múltiplos cursos por post de inspiração
-- Mantém course_id para compatibilidade com posts existentes

ALTER TABLE inspiration_posts
  ADD COLUMN IF NOT EXISTS course_ids uuid[] DEFAULT '{}';

-- Migrar dados existentes: quem tinha course_id único agora tem course_ids com esse valor
UPDATE inspiration_posts
  SET course_ids = ARRAY[course_id]
  WHERE course_id IS NOT NULL
    AND (course_ids IS NULL OR course_ids = '{}');

-- Índice para filtro por curso
CREATE INDEX IF NOT EXISTS idx_inspiration_posts_course_ids
  ON inspiration_posts USING GIN (course_ids);
