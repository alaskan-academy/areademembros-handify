-- Corrige bucket community:
-- 1. Expande MIME types aceitos (PDF, ZIP, DOCX, etc além de imagens)
-- 2. Aumenta limite para 10 MB (consistente com o código)
update storage.buckets
set
  file_size_limit    = 10485760,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain'
  ]
where id = 'community';

-- Policy: aluna autenticada pode fazer upload apenas no seu próprio diretório
-- Caminho esperado: forum/{user_id}/{timestamp}.ext
drop policy if exists "Student upload community forum" on storage.objects;
create policy "Student upload community forum" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community' and
    name like 'forum/' || auth.uid()::text || '/%'
  );

-- Policy: aluna pode deletar apenas seus próprios arquivos do fórum
drop policy if exists "Student delete own community files" on storage.objects;
create policy "Student delete own community files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community' and
    name like 'forum/' || auth.uid()::text || '/%'
  );
