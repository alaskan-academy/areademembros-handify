-- ─── sync_membership_from_payments era a última função que lia a compra errado ──
--
-- Esta é a função que decide se a aluna ganha o Handify Completo. Ela roda
-- sozinha, sem ninguém pedir: a conta nasce em `auth.users` → o gatilho
-- `on_auth_user_created` chama `handle_new_user` → que chama
-- `process_pending_payment_events` → que termina com
-- `perform public.sync_membership_from_payments(v_user_id)`.
-- Ou seja: todo cadastro novo passa por aqui. Se ela lê a compra errado, a
-- aluna cria a conta e o plano simplesmente não aparece — e ninguém é avisado.
--
-- Ela tinha três defeitos, todos da mesma família que o resto do sistema já
-- corrigiu em setembro. Esta função ficou para trás.
--
--
-- ── Defeito 1: só olhava a coluna do código principal ───────────────────────
--
-- A condição era `public.is_plan_code(pe.product_code)`. Só isso. Mas o código
-- do plano pode chegar em mais cinco lugares dentro do mesmo pagamento:
--
--   • dentro de `product.items[]`, quando a compra é um produto agrupado
--     (nesse caso o código do grupo NÃO é o código entregue — quem entrega
--     são os itens);
--   • em `order_bumps[].product.code`, quando o plano entrou como order bump;
--   • em `order_bumps[].product.items[]`, bump que é grupo;
--   • em `Product.product_id`, `product_id` na raiz ou
--     `Subscription.plan.id` — os três lugares da Kiwify.
--
-- A expansão abaixo é a mesma de `process_pending_payment_events`, que por sua
-- vez espelha `extractProductCodes` (src/lib/payments/payt.ts) e
-- `extractKiwifyProductCodes` (src/lib/payments/kiwify.ts). Uma leitura de
-- código de produto, igual em todo lugar.
--
--
-- ── Defeitos 2 e 3: a regra de estorno estava reescrita aqui, e errada ──────
--
-- A subconsulta antiga fazia a própria conta de "esta compra foi estornada?", e
-- fazia mal:
--
--   a) casava por `r.payload->>'transaction_id'` e ainda exigia esse campo não
--      nulo. Medido em 24/09/2026: **dos 63 eventos da Kiwify, 63 não têm
--      transaction_id** — a Kiwify identifica o pedido por `order_id`. A
--      subconsulta era cega para a Kiwify inteira: um plano comprado e
--      estornado lá viraria plano liberado.
--
--   b) tratava `canceled`/`cancelled` como estorno sem olhar `payment_status` e
--      sem exigir que o estorno viesse DEPOIS do pagamento. Medido no banco:
--      dos eventos `canceled`, 1.249 são `payment_status = expired` (PIX
--      vencido) e 517 são `refused` (cartão negado) — e nenhum dos dois vem
--      depois de um pagamento. A Payt reaproveita o número da transação quando
--      o PIX vence, então a sequência real
--      `waiting_payment → canceled → paid` no MESMO número existe e é uma
--      compra boa. Hoje há 4 alunas com exatamente essa sequência
--      (julianabohn22, luciaelenapadovan, laiszugee, ilcatc59). Nenhuma delas
--      comprou o plano — se tivesse comprado, teria ficado sem. É o mesmo erro
--      que em 09/09/2026 revogou o acesso pago de 24 alunas.
--
-- A correção dos dois é uma só: parar de reescrever a regra e chamar
-- `public.compra_estornada(email, transacao)`, corrigida em 24/09/2026, que já
-- faz `coalesce(transaction_id, order_id)`, já lê `payment_status` e já exige
-- `estorno_em > pago_em`. Uma regra de estorno, um lugar.
--
--
-- ── O que sai junto, de propósito: `subscription_canceled` e `subscription_late` ──
--
-- A lista antiga também barrava esses dois. Eles saem, e não é descuido:
--
--   • era código morto. A subconsulta casava por `transaction_id`, e evento de
--     assinatura só existe na Kiwify, que nunca manda `transaction_id`. Esse
--     ramo nunca rodou uma vez sequer;
--   • hoje há 0 eventos `subscription_canceled` e 0 `subscription_late` no
--     banco;
--   • e, no mérito, assinatura cancelada não é dinheiro de volta. "A assinatura
--     acabou" é pergunta de `memberships.expires_at`, não de estorno. Misturar
--     as duas foi o que produziu os defeitos acima.
--
-- Fica anotado como pendência de verdade: hoje esta função concede o plano SEM
-- `expires_at`, ou seja, vitalício, inclusive para compra por assinatura. Isso
-- já era assim antes desta migration e não muda aqui. Quando entrar assinatura
-- de verdade, o conserto é `expires_at`, não remendo na regra de estorno.
--
--
-- ── Impacto medido antes de aplicar (24/09/2026) ────────────────────────────
--
-- Simulei a versão nova em SELECT, lado a lado com a que está no ar:
--
--   eventos pagos no banco ........................ 5.194
--     com produto agrupado ........................    46
--     com order bump ..............................  1.958
--     da Kiwify ...................................    29
--   eventos pagos com código de plano — regra antiga    113
--   eventos pagos com código de plano — regra nova .    113   (ganho 0, perda 0)
--   desses, barrados por estorno — hoje ............     12
--   desses, barrados por estorno — depois ..........     12   (os mesmos 12)
--
-- Os 12 barrados são estorno de verdade: todos têm
-- `payment_status in (refunded, chargeback)` registrado DEPOIS do pagamento.
--
-- No nível de pessoa, que é o que interessa:
--
--   e-mails que ganhariam o plano — hoje .......... 98
--   e-mails que ganhariam o plano — depois ........ 98
--   QUEM GANHA o plano com a mudança .............. 0
--   QUEM PERDE o plano com a mudança .............. 0
--
-- Dos 98, 77 têm conta (e já estão com o plano) e 21 ainda não criaram conta —
-- essas 21 recebem o plano no dia em que se cadastrarem, com a regra nova.
--
-- **Zero alunas mudam de situação hoje.** Era o esperado: o plano nunca chegou
-- dentro de grupo, dentro de bump nem por campo da Kiwify até agora (0 casos de
-- cada), e nenhum evento da Kiwify carrega código de plano. A migration fecha o
-- buraco antes de ele morder, não conserta gente machucada.
--
-- Esta função só INSERE membership; nunca revoga. Aplicar não mexe em plano de
-- ninguém que já tem.

create or replace function public.sync_membership_from_payments(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_email   text;
  v_evento  record;
  v_codigos text[];
begin
  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then return false; end if;

  -- GUARDA DE PLANO DUPLICADO. Não mexer: é ela que impede a mesma aluna
  -- acumular duas linhas de Handify Completo quando a função roda de novo.
  if public.has_active_membership(p_user_id) then return false; end if;

  -- Compras pagas desta aluna, da mais antiga para a mais nova. A primeira que
  -- for do plano e não estiver estornada concede a membership e encerra.
  for v_evento in
    select pe.created_at,
           pe.platform,
           pe.product_code,
           pe.payload,
           -- Payt manda transaction_id; Kiwify manda order_id. Sem o coalesce a
           -- Kiwify inteira fica sem chave e o estorno de lá passa batido.
           coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') as chave
    from public.payment_events pe
    where lower(pe.buyer_email) = lower(v_email)
      and pe.event_type in ('paid', 'approved', 'completed', 'confirmed',
                            'order_approved', 'subscription_renewed')
    order by pe.created_at
  loop
    -- Todos os códigos que ESTA compra entrega. Espelha extractProductCodes
    -- (payt.ts) e extractKiwifyProductCodes (kiwify.ts): produto agrupado
    -- entrega os ITENS e nunca o código do grupo; order bump entrega o dele; e
    -- a Kiwify fala por Product.product_id, product_id na raiz ou pelo id do
    -- plano da assinatura.
    select array_agg(distinct lower(z.cod)) into v_codigos
    from (
      select case when v_evento.payload->'product'->>'type' = 'grouped'
                   and jsonb_array_length(
                         case when jsonb_typeof(v_evento.payload->'product'->'items') = 'array'
                              then v_evento.payload->'product'->'items' else '[]'::jsonb end) > 0
                  then null
                  else v_evento.product_code end as cod
      union all
      select case when v_evento.payload->'product'->>'type' = 'grouped'
                   and jsonb_array_length(
                         case when jsonb_typeof(v_evento.payload->'product'->'items') = 'array'
                              then v_evento.payload->'product'->'items' else '[]'::jsonb end) > 0
                  then null
                  else v_evento.payload->'product'->>'code' end
      union all
      select x->>'code'
        from jsonb_array_elements(
               case when jsonb_typeof(v_evento.payload->'product'->'items') = 'array'
                    then v_evento.payload->'product'->'items' else '[]'::jsonb end) x
       where v_evento.payload->'product'->>'type' = 'grouped'
      union all
      select b->'product'->>'code'
        from jsonb_array_elements(
               case when jsonb_typeof(v_evento.payload->'order_bumps') = 'array'
                    then v_evento.payload->'order_bumps' else '[]'::jsonb end) b
       where coalesce(b->'product'->>'type', '') <> 'grouped'
          or jsonb_array_length(
               case when jsonb_typeof(b->'product'->'items') = 'array'
                    then b->'product'->'items' else '[]'::jsonb end) = 0
      union all
      select w->>'code'
        from jsonb_array_elements(
               case when jsonb_typeof(v_evento.payload->'order_bumps') = 'array'
                    then v_evento.payload->'order_bumps' else '[]'::jsonb end) b,
             jsonb_array_elements(
               case when jsonb_typeof(b->'product'->'items') = 'array'
                    then b->'product'->'items' else '[]'::jsonb end) w
       where b->'product'->>'type' = 'grouped'
      union all select v_evento.payload->'Product'->>'product_id'
      union all select v_evento.payload->>'product_id'
      union all select v_evento.payload->'Subscription'->'plan'->>'id'
    ) z
    where z.cod is not null and z.cod <> '';

    if v_codigos is null then continue; end if;

    -- Esta compra é do plano?
    if not exists (
      select 1 from unnest(v_codigos) k where public.is_plan_code(k)
    ) then
      continue;
    end if;

    -- O dinheiro DESTA compra voltou? Quem responde é compra_estornada, que já
    -- sabe de Kiwify, de payment_status e da ordem dos fatos. Aqui não se
    -- reescreve essa regra.
    --
    -- Sem chave (nem transaction_id nem order_id) não dá para amarrar estorno
    -- nenhum a esta compra, então ela segue valendo — é o que a função já fazia
    -- antes. Hoje isso é teórico: os 5.194 eventos pagos têm chave.
    if v_evento.chave is not null
       and public.compra_estornada(v_email, v_evento.chave) then
      continue;
    end if;

    insert into public.memberships (user_id, plan, source, granted_at, reason)
    values (
      p_user_id,
      'completo',
      case when lower(coalesce(v_evento.platform, '')) = 'kiwify'
           then 'kiwify' else 'payt' end::public.membership_source,
      v_evento.created_at,
      'compra do plano em payment_events'
    );
    return true;
  end loop;

  return false;
end;
$function$;

comment on function public.sync_membership_from_payments(uuid) is
  'Concede o Handify Completo pela primeira compra paga e nao estornada do plano. Le o codigo do plano em todos os lugares onde ele chega (grupo, order bump, Kiwify) e delega o estorno a compra_estornada. Nunca revoga.';

-- `revoke ... from anon, authenticated` NAO fecha nada: os dois herdam de
-- PUBLIC. Tem que ser de PUBLIC, com a assinatura exata.
revoke all on function public.sync_membership_from_payments(uuid) from public;
grant execute on function public.sync_membership_from_payments(uuid) to service_role;

-- Conferir depois de aplicar (tem que sair {postgres=X/postgres,service_role=X/postgres}):
--   select proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'sync_membership_from_payments';
