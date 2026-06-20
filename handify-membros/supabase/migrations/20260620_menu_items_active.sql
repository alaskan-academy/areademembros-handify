-- Adiciona coluna active e insere itens padrão no menu
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Atualiza políticas para filtrar ativos nos selects públicos
DROP POLICY IF EXISTS "Menu público para guest" ON public.menu_items;
DROP POLICY IF EXISTS "Menu student para autenticados" ON public.menu_items;
DROP POLICY IF EXISTS "Menu admin para admins" ON public.menu_items;

CREATE POLICY "Menu público para guest" ON public.menu_items
  FOR SELECT USING (visible_to = 'guest' AND active = true);

CREATE POLICY "Menu student para autenticados" ON public.menu_items
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND visible_to IN ('guest', 'student')
    AND active = true
  );

-- Admin vê todos (ativos e inativos)
CREATE POLICY "Menu admin para admins" ON public.menu_items
  FOR SELECT USING (public.is_admin());

-- Itens padrão (só insere se a tabela estiver vazia)
INSERT INTO public.menu_items (label, url, icon, visible_to, position, active)
SELECT * FROM (VALUES
  ('Minha Jornada', '/dashboard',  'LayoutDashboard', 'student'::public.menu_visibility, 1,  true),
  ('Cursos',        '/cursos',     'BookOpen',         'guest'::public.menu_visibility,   2,  true),
  ('Perfil',        '/perfil',     'User',             'student'::public.menu_visibility, 3,  true),
  ('Admin',         '/admin',      'Settings',         'admin'::public.menu_visibility,   99, true)
) AS v(label, url, icon, visible_to, position, active)
WHERE NOT EXISTS (SELECT 1 FROM public.menu_items LIMIT 1);
