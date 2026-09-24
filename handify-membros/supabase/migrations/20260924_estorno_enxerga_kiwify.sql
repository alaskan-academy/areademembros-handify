-- ─── `compra_estornada` era 100% cega para a Kiwify ─────────────────────────
--
-- A função é quem responde "o dinheiro desta compra voltou?" — e decide se uma
-- compra vira acesso no cadastro, se o token de ativação pode ser usado e se o
-- botão de matrícula retroativa deve devolver o curso.
--
-- Ela chaveava por `payload->>'transaction_id'` e ainda exigia esse campo não
-- nulo. Medido em 24/09/2026: **dos 63 eventos da Kiwify, 63 não têm
-- transaction_id** — a Kiwify identifica a transação por `order_id`. Ou seja, a
-- função não enxergava uma única compra da Kiwify, e um estorno de lá viraria
-- acesso liberado. Não mordeu ninguém porque ainda não houve estorno da Kiwify;
-- morderia no primeiro.
--
-- ── Sobre incluir `canceled` ────────────────────────────────────────────────
--
-- O caminho real de estorno da Payt é `paid → refund_requested → canceled`, e
-- `canceled` não estava na lista. Mas `canceled` é ambíguo, então em vez de
-- confiar no nome eu contei o que cada um é hoje:
--
--   payment_status      eventos   vieram depois de um pagamento
--   expired               1.249                  0   ← PIX vencido
--   refused                 517                  0   ← cartão negado
--   refunded                 80                 80   ← já pego pelo ramo acima
--   canceled                 20                  0   ← cancelamento sem pagamento
--   (sem payment_status)     16                  3   ← ESTES são os perdidos
--
-- Por isso `canceled` entra **apenas no ramo de fallback**, o que só vale
-- quando `payment_status` vem nulo. No ramo do payment_status ele fica de fora
-- de propósito: aqueles 20 nunca seguem um pagamento, e tratá-los como estorno
-- seria repetir o erro de 09/09/2026, quando um PIX abandonado revogou o acesso
-- pago de 24 alunas.
--
-- A exigência `estorno_em > pago_em` continua sendo a rede final: é ela que
-- protege as alunas cujo PIX venceu e que pagaram no dia seguinte com o mesmo
-- número de transação.
--
-- ── Impacto medido antes de aplicar ─────────────────────────────────────────
--
-- Simulei a versão nova em SELECT e comparei com a que está no ar: de 78
-- e-mails classificados como estornados, 76 já eram. Os 2 novos são
-- `academyalaskan@gmail.com` e `socialmedia.jessiveiga@gmail.com` — a conta da
-- equipe e a compra de teste da Jessica. **Nenhuma aluna real muda de lado.**
--
-- A função não revoga nada sozinha: ela é consultada na hora do webhook e do
-- cadastro. Aplicar não mexe em matrícula existente.

create or replace function public.compra_estornada(p_email text, p_transaction_id text default null::text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  with tx as (
    select
      -- A Payt manda transaction_id; a Kiwify manda order_id. Sem o coalesce a
      -- Kiwify inteira ficava fora da conta.
      coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') as transacao,
      max(pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ) as pago_em,
      max(pe.created_at) filter (
        where pe.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
           or (pe.payload->'transaction'->>'payment_status' is null
               and pe.event_type in ('refunded','order_refunded','chargeback','chargedback',
                                     'canceled','cancelled'))
      ) as estorno_em
    from public.payment_events pe
    where lower(pe.buyer_email) = lower(p_email)
      and coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') is not null
      and (p_transaction_id is null
           or coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') = p_transaction_id)
    group by 1
  )
  select exists (
    select 1 from tx
    where pago_em is not null
      and estorno_em is not null
      -- Estorno tem que vir DEPOIS do pagamento. É esta linha que impede o PIX
      -- vencido-e-pago-no-dia-seguinte de ser lido como reembolso.
      and estorno_em > pago_em
  );
$function$;

comment on function public.compra_estornada(text, text) is
  'O dinheiro desta compra voltou? Reconhece Payt (transaction_id) e Kiwify (order_id). canceled só conta como estorno quando nao ha payment_status — PIX vencido e cartao negado nunca seguem um pagamento.';

revoke all on function public.compra_estornada(text, text) from public;
grant execute on function public.compra_estornada(text, text) to service_role;
