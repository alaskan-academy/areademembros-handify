-- Bucket público para imagens de banners
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Apenas admin pode fazer upload
drop policy if exists "Admin upload banners" on storage.objects;
create policy "Admin upload banners" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'banners' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Apenas admin pode atualizar/substituir
drop policy if exists "Admin update banners" on storage.objects;
create policy "Admin update banners" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'banners' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Apenas admin pode excluir arquivos do bucket
drop policy if exists "Admin delete banners storage" on storage.objects;
create policy "Admin delete banners storage" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'banners' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Leitura pública (as imagens são exibidas para todas as alunas/visitantes)
drop policy if exists "Public read banners storage" on storage.objects;
create policy "Public read banners storage" on storage.objects
  for select
  using (bucket_id = 'banners');
