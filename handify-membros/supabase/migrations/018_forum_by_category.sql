-- Fórum por categoria: cria tabela forums independente, vincula a courses e forum_posts

-- 1. Tabela forums
CREATE TABLE IF NOT EXISTS public.forums (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  description text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;

-- 2. Vincular cursos a fóruns (deve existir ANTES das policies que referenciam c.forum_id)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS forum_id uuid REFERENCES public.forums(id) ON DELETE SET NULL;

-- Admin gerencia tudo
CREATE POLICY "Admin gerencia fóruns" ON public.forums
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Aluna lê fóruns de cursos em que está matriculada
CREATE POLICY "Membro lê fórum acessível" ON public.forums
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE c.forum_id = forums.id
        AND e.user_id = auth.uid()
        AND (e.expires_at IS NULL OR e.expires_at > now())
    )
  );

-- 3. Vincular posts ao fórum (novo campo)
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS forum_id uuid REFERENCES public.forums(id) ON DELETE CASCADE;

-- Tornar course_id nullable (substituído por forum_id)
ALTER TABLE public.forum_posts
  ALTER COLUMN course_id DROP NOT NULL;

-- 4. Função de membro de fórum
CREATE OR REPLACE FUNCTION public.is_forum_member(p_forum_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN  public.courses c ON c.id = e.course_id
    WHERE e.user_id = auth.uid()
      AND c.forum_id = p_forum_id
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;

-- 5. RLS forum_posts — usar forum_id quando disponível, fallback course_id (legado)
DROP POLICY IF EXISTS "Matriculada vê posts do fórum do curso" ON public.forum_posts;
DROP POLICY IF EXISTS "Matriculada vê posts do fórum"          ON public.forum_posts;
DROP POLICY IF EXISTS "Matriculada cria post no fórum"         ON public.forum_posts;
DROP POLICY IF EXISTS "Aluna deleta próprio post"              ON public.forum_posts;
DROP POLICY IF EXISTS "Admin gerencia posts do fórum"          ON public.forum_posts;

CREATE POLICY "Aluna lê post do fórum" ON public.forum_posts
  FOR SELECT USING (
    (
      (forum_id IS NOT NULL AND public.is_forum_member(forum_id))
      OR
      (forum_id IS NULL AND course_id IS NOT NULL AND public.is_enrolled(course_id))
    )
    AND (approved = true OR user_id = auth.uid())
  );

CREATE POLICY "Aluna cria post no fórum" ON public.forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (forum_id IS NOT NULL AND public.is_forum_member(forum_id))
      OR
      (forum_id IS NULL AND course_id IS NOT NULL AND public.is_enrolled(course_id))
    )
  );

CREATE POLICY "Aluna deleta próprio post no fórum" ON public.forum_posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin gerencia posts do fórum" ON public.forum_posts
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
