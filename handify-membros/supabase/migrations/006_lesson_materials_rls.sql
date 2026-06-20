-- RLS para lesson_content_blocks e lesson_materials
-- (tabelas criadas na 002_tables.sql, RLS não havia sido aplicada)

alter table public.lesson_content_blocks enable row level security;
alter table public.lesson_materials       enable row level security;

-- Storage bucket para materiais de aulas (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-materials',
  'lesson-materials',
  false,
  52428800, -- 50MB
  array['application/pdf','application/zip','image/png','image/jpeg','image/webp',
        'video/mp4','audio/mpeg','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do nothing;

-- lesson_content_blocks: admin gerencia, aluna lê se matriculada
create policy "Admin gerencia blocos de conteudo" on public.lesson_content_blocks
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Aluna le blocos de aulas do curso matriculado" on public.lesson_content_blocks
  for select using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.course_id = m.course_id
      where l.id = lesson_content_blocks.lesson_id
        and e.user_id = auth.uid()
        and (e.expires_at is null or e.expires_at > now())
    )
    -- prévia pública
    or exists (
      select 1 from public.lessons l
      where l.id = lesson_content_blocks.lesson_id and l.is_preview = true
    )
  );

-- lesson_materials: admin gerencia, aluna baixa se matriculada
create policy "Admin gerencia materiais" on public.lesson_materials
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Aluna ve materiais do curso matriculado" on public.lesson_materials
  for select using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.course_id = m.course_id
      where l.id = lesson_materials.lesson_id
        and e.user_id = auth.uid()
        and (e.expires_at is null or e.expires_at > now())
    )
  );

-- Storage: admin faz upload/delete, aluna baixa via signed URL (sem acesso direto)
create policy "Admin faz upload de materiais" on storage.objects
  for insert with check (
    bucket_id = 'lesson-materials' and public.is_admin()
  );

create policy "Admin deleta materiais" on storage.objects
  for delete using (
    bucket_id = 'lesson-materials' and public.is_admin()
  );

create policy "Aluna acessa materiais via signed URL" on storage.objects
  for select using (
    bucket_id = 'lesson-materials' and auth.role() = 'authenticated'
  );
