-- Lista de e-mails que nunca devem receber disparo da plataforma.
-- Pedido da Jessica em 09/09/2026. A checagem fica na camada de envio
-- (src/lib/email/index.ts), não em cada script — assim vale para campanha,
-- reengajamento, acesso liberado, certificado e alarme.
create table if not exists public.email_suppressions (
  email       text primary key,
  reason      text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null
);

comment on table public.email_suppressions is
  'E-mails que a plataforma nunca envia. Checado em enviarEmail() e no lote.';

create or replace function public.normaliza_email_suppression()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

drop trigger if exists email_suppressions_normaliza on public.email_suppressions;
create trigger email_suppressions_normaliza
  before insert or update on public.email_suppressions
  for each row execute function public.normaliza_email_suppression();

alter table public.email_suppressions enable row level security;

drop policy if exists "Admin gerencia supressoes" on public.email_suppressions;
create policy "Admin gerencia supressoes" on public.email_suppressions
  for all using (public.is_admin());

revoke all on public.email_suppressions from public, anon;
grant select on public.email_suppressions to authenticated;
grant all on public.email_suppressions to service_role;
