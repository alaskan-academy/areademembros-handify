-- ─── Vendeu um código que a plataforma não conhece ───────────────────────────
--
-- O webhook só reclama quando NÃO acha curso nenhum para a compra. Se acha
-- alguns e não acha outros, matricula os que achou e grava o evento como
-- processado, sem erro. A compra parece perfeita no painel e a aluna fica sem
-- um dos itens.
--
-- Foi isso que aconteceu entre 11/07 e 05/08/2026, com 46 matrículas em 40
-- alunas. O mesmo produto era vendido em variantes com códigos diferentes
-- ("Guia Rápido ... Plus" = LXMBWB, "Guia Rápido ... Handify" = LGAYMO), e só
-- uma delas estava em courses.checkout_codes. Quem comprou a variante
-- cadastrada recebeu (11 de 13); quem comprou a outra, quase sempre não
-- (19 de 65).
--
-- Ninguém tinha como saber: a compra tinha outros itens que foram liberados
-- normalmente, então nada ficava vermelho em lugar nenhum.

-- Nem todo código vendido vira curso. A "Lista de Fornecedores Premium"
-- (RKPKZ5) é entregue por fora da plataforma e não deve alarmar nunca.
create table if not exists public.checkout_codes_ignorados (
  codigo      text primary key,
  motivo      text not null,
  criado_em   timestamptz not null default now(),
  criado_por  uuid references public.profiles(id)
);

alter table public.checkout_codes_ignorados enable row level security;

drop policy if exists "Admin gerencia codigos ignorados" on public.checkout_codes_ignorados;
create policy "Admin gerencia codigos ignorados" on public.checkout_codes_ignorados
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.checkout_codes_ignorados is
  'Códigos de checkout que não correspondem a curso e não devem virar alarme — produto entregue por fora da plataforma.';

insert into public.checkout_codes_ignorados (codigo, motivo)
values ('RKPKZ5', 'Lista de Fornecedores Premium — entregue por fora da plataforma (confirmado pela Jessica em 13/09/2026)')
on conflict (codigo) do nothing;

-- Códigos que apareceram em compra paga e não estornada e que não estão em
-- nenhum curso. Espelha `extractProductCodes()`: produto agrupado entrega os
-- itens, não o código do grupo — usar o código do grupo aqui produziria
-- falso positivo, que foi exatamente o erro da primeira varredura.
create or replace function public.codigos_vendidos_sem_curso(dias int default 30)
returns table (
  codigo        text,
  nome_produto  text,
  compras       bigint,
  primeira      date,
  ultima        date
)
language sql
stable
security definer
set search_path = public
as $$
  with pagas as (
    select pe.payload as pl, pe.created_at
    from public.payment_events pe
    where pe.event_type in ('paid','approved','completed','order_approved')
      and coalesce((pe.payload->>'test')::boolean, false) = false
      and pe.created_at > now() - make_interval(days => dias)
      and not exists (
        select 1 from public.payment_events est
        where est.payload->>'transaction_id' = pe.payload->>'transaction_id'
          and est.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
      )
  ),
  codigos as (
    select p.created_at, z.cod, z.nome
    from pagas p
    cross join lateral (
      -- produto simples
      select case when p.pl->'product'->>'type' = 'grouped'
                   and jsonb_array_length(coalesce(p.pl->'product'->'items','[]'::jsonb)) > 0
                  then null else p.pl->'product'->>'code' end as cod,
             p.pl->'product'->>'name' as nome
      union all
      -- itens do produto agrupado
      select x->>'code', x->>'name'
        from jsonb_array_elements(coalesce(p.pl->'product'->'items','[]'::jsonb)) x
       where p.pl->'product'->>'type' = 'grouped'
      union all
      -- bump simples
      select b->'product'->>'code', b->'product'->>'name'
        from jsonb_array_elements(coalesce(p.pl->'order_bumps','[]'::jsonb)) b
       where coalesce(b->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(b->'product'->'items','[]'::jsonb)) = 0
      union all
      -- itens do bump agrupado
      select w->>'code', w->>'name'
        from jsonb_array_elements(coalesce(p.pl->'order_bumps','[]'::jsonb)) b,
             jsonb_array_elements(coalesce(b->'product'->'items','[]'::jsonb)) w
       where b->'product'->>'type' = 'grouped'
    ) z
    where z.cod is not null
  )
  select c.cod, max(c.nome), count(*), min(c.created_at)::date, max(c.created_at)::date
  from codigos c
  where not exists (select 1 from public.courses co where co.checkout_codes && array[c.cod])
    and not exists (select 1 from public.checkout_codes_ignorados i where i.codigo = c.cod)
  group by c.cod
  order by count(*) desc;
$$;

comment on function public.codigos_vendidos_sem_curso(int) is
  'Códigos vendidos que não mapeiam para nenhum curso. Cada um é uma aluna pagando por algo que a plataforma não entrega.';

revoke all on function public.codigos_vendidos_sem_curso(int) from anon, authenticated;
