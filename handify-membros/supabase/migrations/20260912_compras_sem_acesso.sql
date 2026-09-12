-- ─── Quem pagou e não está com o curso ───────────────────────────────────────
--
-- Rede de segurança do cron `/api/cron/compras-sem-acesso`.
--
-- Em 12/09/2026 a varredura achou 7 alunas pagantes sem acesso — 43 matrículas,
-- a mais antiga parada há 41 dias. Nenhuma delas tinha reclamado, e nada no
-- sistema avisava. O cadastro e o webhook passaram a ligar a compra pelo
-- telefone; esta função é para o que escapar da regra.
--
-- Devolve CANDIDATOS: a conferência do primeiro nome fica no TypeScript
-- (`mesmoPrimeiroNome`), para a regra de identidade existir num lugar só.
--
-- Filtrar aqui e não no PostgREST é o que evita o corte de 1.000 linhas —
-- são ~2.000 tokens pendentes, e um corte silencioso esconderia justamente as
-- alunas que este alarme existe para achar.
create or replace function public.compras_sem_acesso(dias_minimos int default 1)
returns table (
  email_da_compra   text,
  email_da_conta    text,
  nome_da_compra    text,
  nome_da_conta     text,
  vinculo           text,
  user_id           uuid,
  curso             text,
  comprado_em       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with tokens as (
    select t.email, t.course_id, t.buyer_name, t.buyer_phone_norm, t.created_at
    from public.activation_tokens t
    where not t.used
      and t.course_id is not null
      -- Dá tempo de a aluna receber o e-mail e se cadastrar antes de virar alarme.
      and t.created_at < now() - make_interval(days => dias_minimos)
  ),
  candidatos as (
    -- Conta com o e-mail exato da compra. Sem ambiguidade nenhuma: é a conta
    -- dela, é a compra dela, e o curso não está lá.
    select t.email, p.email as conta_email, t.buyer_name, p.full_name,
           'email'::text as vinculo, p.id as user_id, t.course_id, t.created_at
    from tokens t
    join public.profiles p on lower(p.email) = lower(t.email)

    union all

    -- Nenhuma conta com aquele e-mail: procura pelo telefone. O primeiro nome
    -- ainda será conferido no TypeScript antes de virar alarme.
    select t.email, p.email, t.buyer_name, p.full_name,
           'telefone'::text, p.id, t.course_id, t.created_at
    from tokens t
    join public.profiles p
      on p.phone_norm = t.buyer_phone_norm
     and length(t.buyer_phone_norm) >= 10
     and p.role <> 'admin'
    where not exists (
      select 1 from public.profiles p2 where lower(p2.email) = lower(t.email)
    )
  )
  select c.email, c.conta_email, c.buyer_name, c.full_name, c.vinculo,
         c.user_id, co.title, c.created_at
  from candidatos c
  join public.courses co on co.id = c.course_id
  where not exists (
    select 1 from public.enrollments e
    where e.user_id = c.user_id
      and e.course_id = c.course_id
      and (e.expires_at is null or e.expires_at > now())
  )
  order by c.created_at;
$$;

comment on function public.compras_sem_acesso(int) is
  'Compras pagas cuja aluna tem conta na plataforma mas não está matriculada. Candidatos — o vínculo por telefone ainda depende do primeiro nome bater.';

revoke all on function public.compras_sem_acesso(int) from anon, authenticated;
