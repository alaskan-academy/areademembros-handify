-- Sem search_path fixo, quem chama a função pode apontar `profiles` ou
-- `enrollments` para uma tabela própria e enganar a verificação. As três
-- primeiras são SECURITY DEFINER, então rodariam com privilégio elevado.
--
-- Todos os objetos dentro delas já estão qualificados (public.profiles,
-- auth.uid()), então search_path vazio não muda comportamento nenhum.
-- Validado depois de aplicar: aluna real continua vendo só os cursos dela.
alter function public.is_admin()                           set search_path = '';
alter function public.is_enrolled(uuid)                    set search_path = '';
alter function public.is_forum_member(uuid)                set search_path = '';
alter function public.touch_suppliers_updated_at()         set search_path = '';
alter function public.touch_inspiration_posts_updated_at() set search_path = '';
