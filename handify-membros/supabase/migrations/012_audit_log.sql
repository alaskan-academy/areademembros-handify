-- Tabela de auditoria de ações administrativas
create table if not exists public.audit_log (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references public.profiles(id),
  action      text        not null,   -- 'grant_access' | 'revoke_access' | 'ban' | 'unban'
  target_type text        not null,   -- 'enrollment' | 'user'
  target_id   uuid,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "Admin lê audit_log" on public.audit_log;
create policy "Admin lê audit_log" on public.audit_log
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin insere audit_log" on public.audit_log;
create policy "Admin insere audit_log" on public.audit_log
  for insert to authenticated
  with check (
    admin_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
