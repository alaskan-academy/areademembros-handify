-- ─── D15: corrigir o e-mail da aluna apagava a prova do pagamento ───────────
--
-- `correctEmailAction` fazia um UPDATE em `payment_events` sem SELECT antes,
-- sem id no WHERE e sem guardar o valor antigo: o endereço com que a compra
-- entrou sumia da coluna consultável. 40 linhas ficaram assim, e duas delas em
-- cascata — endereço já corrigido virando outro, dois saltos de distância da
-- verdade. Nem toda correção é typo da mesma pessoa: uma delas troca o titular
-- do pagamento.
--
-- O que salva é que o `payload` nunca foi tocado. Payt guarda o comprador em
-- `payload->'customer'->>'email'` e a Kiwify em `payload->'Customer'->>'email'`,
-- os dois 100% preenchidos. Dá para recuperar exatamente.

-- 1. Endereço com que a compra entrou. Preenchido uma única vez, nunca
--    sobrescrito (o código faz `coalesce(original, atual)` na segunda correção).
alter table public.payment_events
  add column if not exists buyer_email_original text;

comment on column public.payment_events.buyer_email_original is
  'Endereço com que a compra chegou, antes de qualquer correção manual. Set-once: nunca sobrescrever.';

-- 2. Backfill das linhas que correctEmailAction já reescreveu.
update public.payment_events
set buyer_email_original = coalesce(
      payload->'customer'->>'email',
      payload->'Customer'->>'email')
where buyer_email_original is null
  and coalesce(payload->'customer'->>'email', payload->'Customer'->>'email') is not null
  and lower(buyer_email) is distinct from
      lower(coalesce(payload->'customer'->>'email', payload->'Customer'->>'email'));
-- CONFERIR: deve afetar exatamente 40 linhas. Outro número = parar e investigar.

create index if not exists payment_events_buyer_email_original_idx
  on public.payment_events (lower(buyer_email_original));

-- 3. Log imutável das correções de endereço.
create table if not exists public.buyer_email_corrections (
  id uuid primary key default gen_random_uuid(),
  old_email text not null,
  new_email text not null,
  admin_id uuid references auth.users(id),
  payment_event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists buyer_email_corrections_old_idx
  on public.buyer_email_corrections (lower(old_email));
create index if not exists buyer_email_corrections_new_idx
  on public.buyer_email_corrections (lower(new_email));

alter table public.buyer_email_corrections enable row level security;

-- Sem policy de insert/update/delete: só o service role escreve.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buyer_email_corrections'
      and policyname = 'admin le correcoes de email'
  ) then
    create policy "admin le correcoes de email"
      on public.buyer_email_corrections for select
      using (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.role = 'admin'));
  end if;
end $$;

-- 4. Semeia com as 26 correções que já aconteceram, lidas do audit_log.
insert into public.buyer_email_corrections (old_email, new_email, admin_id, created_at)
select lower(meta->>'old_email'), lower(meta->>'new_email'), admin_id, created_at
from public.audit_log
where action = 'correct_buyer_email'
  and meta->>'old_email' is not null
  and meta->>'new_email' is not null;
-- CONFERIR: 26 linhas.

-- DELIBERADO: `buyer_email` NÃO volta ao valor original. Seis funções do banco
-- leem essa coluna para decidir acesso (`process_pending_payment_events`,
-- `sync_membership_from_payments`, `acesso_revogado_mas_pago`,
-- `compra_estornada`, `curso_coberto_por_outra_compra`,
-- `admin_conversion_stats`). Restaurar o endereço digitado errado tiraria o
-- Completo e a matrícula de aluna que pagou — consertar a auditoria não pode
-- custar o acesso dela. A prova volta na coluna nova; a chave operacional fica.

-- VERIFICAÇÃO (só select):
--   select count(*) from payment_events where buyer_email_original is not null;  -- 40
--   select count(*) from buyer_email_corrections;                                -- 26
--   select count(*) from payment_events p
--    where p.buyer_email_original is null
--      and lower(p.buyer_email) is distinct from
--          lower(coalesce(p.payload->'customer'->>'email', p.payload->'Customer'->>'email'));  -- 0
