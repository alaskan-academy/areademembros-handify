-- Bucket público para imagens da comunidade (feed + fórum)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community',
  'community',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "Admin upload community" on storage.objects;
create policy "Admin upload community" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin update community" on storage.objects;
create policy "Admin update community" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin delete community storage" on storage.objects;
create policy "Admin delete community storage" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Public read community storage" on storage.objects;
create policy "Public read community storage" on storage.objects
  for select
  using (bucket_id = 'community');
