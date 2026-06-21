-- Moderação de posts do fórum + suporte a imagem/arquivo pela aluna

-- 1. Coluna approved (true para posts já existentes, false por padrão para novos)
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;

ALTER TABLE public.forum_posts
  ALTER COLUMN approved SET DEFAULT false;

-- 2. Colunas para anexo de arquivo
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- 3. RLS: aluna vê apenas posts aprovados OU os próprios posts pendentes
DROP POLICY IF EXISTS "Matriculada vê posts do fórum do curso" ON public.forum_posts;
CREATE POLICY "Matriculada vê posts do fórum do curso" ON public.forum_posts
  FOR SELECT USING (
    public.is_enrolled(course_id)
    AND (approved = true OR user_id = auth.uid())
  );

-- 4. Storage: alunas não banidas podem fazer upload em community/forum/
DROP POLICY IF EXISTS "Student upload community forum" ON storage.objects;
CREATE POLICY "Student upload community forum" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community'
    AND name LIKE 'forum/%'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND banned = false
    )
  );
