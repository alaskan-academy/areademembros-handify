-- Bucket público para fotos de perfil das alunas
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Qualquer pessoa pode ver avatares (bucket já é público, mas política explícita)
create policy "Avatares são públicos"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Usuária autenticada pode fazer upload/atualizar apenas seu próprio avatar
create policy "Upload do próprio avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '.%')
  );

create policy "Atualizar o próprio avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid()::text || '.%')
  );
