-- Correção da migration 018 (colunas podem não ter aplicado) + suporte a arquivamento

-- 1. Garantir coluna forum_id em courses (pode não ter aplicado na 018)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS forum_id uuid REFERENCES public.forums(id) ON DELETE SET NULL;

-- 2. Garantir coluna forum_id e attachment em forum_posts
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS forum_id uuid REFERENCES public.forums(id) ON DELETE CASCADE;

-- Tornar course_id nullable se ainda não for (018 pode não ter rodado)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'forum_posts'
      AND column_name = 'course_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.forum_posts ALTER COLUMN course_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Coluna archived para fóruns
ALTER TABLE public.forums
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- 4. Recriar função is_forum_member (agora courses.forum_id existe com certeza)
CREATE OR REPLACE FUNCTION public.is_forum_member(p_forum_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN  public.courses c ON c.id = e.course_id
    WHERE e.user_id  = auth.uid()
      AND c.forum_id = p_forum_id
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;

-- 5. RLS forums — recriar policy de leitura para alunas (exclui arquivados)
DROP POLICY IF EXISTS "Membro lê fórum acessível" ON public.forums;
CREATE POLICY "Membro lê fórum acessível" ON public.forums
  FOR SELECT TO authenticated
  USING (
    archived = false
    AND EXISTS (
      SELECT 1 FROM public.courses c
      JOIN  public.enrollments e ON e.course_id = c.id
      WHERE c.forum_id   = forums.id
        AND e.user_id    = auth.uid()
        AND (e.expires_at IS NULL OR e.expires_at > now())
    )
  );

-- 6. RLS forum_posts — recriar todas as policies (018 pode ter falhado aqui também)
DROP POLICY IF EXISTS "Aluna lê post do fórum"           ON public.forum_posts;
DROP POLICY IF EXISTS "Aluna cria post no fórum"         ON public.forum_posts;
DROP POLICY IF EXISTS "Aluna deleta próprio post no fórum" ON public.forum_posts;
DROP POLICY IF EXISTS "Admin gerencia posts do fórum"    ON public.forum_posts;
DROP POLICY IF EXISTS "Matriculada vê posts do fórum do curso" ON public.forum_posts;
DROP POLICY IF EXISTS "Matriculada vê posts do fórum"    ON public.forum_posts;
DROP POLICY IF EXISTS "Matriculada cria post no fórum"   ON public.forum_posts;
DROP POLICY IF EXISTS "Aluna deleta próprio post"        ON public.forum_posts;

CREATE POLICY "Aluna lê post do fórum" ON public.forum_posts
  FOR SELECT USING (
    (approved = true OR user_id = auth.uid())
    AND (
      (forum_id IS NOT NULL AND public.is_forum_member(forum_id))
      OR
      (forum_id IS NULL AND course_id IS NOT NULL AND public.is_enrolled(course_id))
    )
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
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin gerencia posts do fórum" ON public.forum_posts
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
