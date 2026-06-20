-- Adiciona tipo e descricao nas aulas
alter table public.lessons
  add column if not exists lesson_type text not null default 'video'
    check (lesson_type in ('video','document','html','link','mixed')),
  add column if not exists description text;

-- Bucket publico para thumbnails de cursos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-thumbnails',
  'course-thumbnails',
  true,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Admin faz upload/delete; qualquer um pode ver (bucket publico)
create policy "Admin upload thumbnail" on storage.objects
  for insert with check (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "Admin delete thumbnail" on storage.objects
  for delete using (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "Thumbnail publica" on storage.objects
  for select using (bucket_id = 'course-thumbnails');
