-- Registro de quem ja recebeu cada campanha de e-mail. Serve para mandar em
-- lotes sem repetir e para saber o alcance depois. Escrito pelo script de
-- disparo (service role); nenhuma aluna le nem escreve aqui.
create table if not exists public.email_campaign_sends (
  campaign   text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  email      text not null,
  sent_at    timestamptz not null default now(),
  primary key (campaign, user_id)
);

comment on table public.email_campaign_sends is
  'Quem ja recebeu cada campanha (ex.: plano-completo-2026-09). Evita disparo repetido em lotes.';

alter table public.email_campaign_sends enable row level security;
revoke all on public.email_campaign_sends from anon, authenticated;

drop policy if exists "Admin ve os envios" on public.email_campaign_sends;
create policy "Admin ve os envios" on public.email_campaign_sends
  for select to authenticated using (public.is_admin());
