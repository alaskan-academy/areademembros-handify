-- ─── D03: quem o botão "acesso retroativo" tem que alcançar ─────────────────
--
-- O botão existe para remendar a aluna que pagou e ficou sem o curso. Ele
-- perguntava errado, de cinco jeitos ao mesmo tempo:
--
-- 1. lia `payment_events` com um select solto. O PostgREST corta em 1.000 sem
--    erro e sem aviso, e "Curso Saponária Brasil" tem 3.171 eventos casando —
--    a ferramenta via 1.000 linhas arbitrárias de 3.171;
-- 2. casava só por `payment_events.product_code`, que guarda apenas o produto
--    PRINCIPAL da compra. Item de produto agrupado e order bump existem só
--    dentro do `payload` — 4.896 pares (aluna, curso) eram invisíveis;
-- 3. casava pelo código do GRUPO. O kit L9QEPN está cadastrado em quatro
--    cursos, e a compra do kit liberava curso que o kit não inclui (282 pares).
--    `extractProductCodes` (src/lib/payments/payt.ts:156) descarta o código do
--    grupo de propósito e entrega os itens — aqui é o mesmo contrato;
-- 4. não excluía transação estornada: 285 pares alcançáveis vinham de compra
--    devolvida;
-- 5. exigia `processed = true`, ou seja, ignorava justamente os eventos que
--    falharam — que são os que precisam de reparo.
--
-- Esta função faz a pergunta certa dentro do SQL: extração igual à do webhook,
-- estorno fora, e `order by` + `limit` para o resultado nunca vir cortado em
-- silêncio.
--
-- ─── Revisão de 22/09/2026, antes de aplicar ────────────────────────────────
--
-- A primeira escrita desta função ainda errava em três pontos. Medido no banco,
-- com a função rodada contra os 24 cursos de uma vez: ela devolvia 8 pares
-- (aluna, curso); passa a devolver 6.
--
--  a) o filtro de estorno não conhecia o caminho real da Payt. Estorno na Payt
--     é `paid -> refund_requested -> canceled`, e o evento final chega como
--     `canceled`, não como `refunded`. Os 74 casos em que esse `canceled` traz
--     `payment_status = 'refunded'` já caíam pelo primeiro ramo; os 3 em que
--     ele chega sem `payment_status` nenhum passavam direto. Um deles é o
--     "Curso Flores de Alto Padrão" de socialmedia.jessiveiga@gmail.com:
--     pago 02/07 21:40, reembolso pedido 21:57, cancelado 21:57 — e a
--     ferramenta se oferecia para devolver o acesso reembolsado;
--  b) faltava `Subscription.plan.id`. `extractKiwifyProductCodes`
--     (kiwify.ts:127) lê três lugares — `Product.product_id`, `product_id` na
--     raiz e o id do plano da assinatura — e aqui só dois estavam escritos;
--  c) a conta admin (academyalaskan@gmail.com, "Equipe Handify") era uma das
--     8 linhas: ela comprou "Workshop Buquê de Velas" em 02/07 para testar o
--     checkout. O botão matricularia a admin como aluna.
--
-- Aditiva: `codigos_vendidos_sem_curso` e `process_pending_payment_events`
-- continuam como estão, têm outros consumidores.

create or replace function public.alunas_para_matricula_retroativa(
  p_course_id uuid,
  p_limite integer default 500
)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with pagas as (
    select
      pe.payload as pl,
      lower(pe.buyer_email) as em,
      -- O instante do pagamento entra no resultado porque o filtro de estorno
      -- abaixo precisa comparar as duas datas. Sem ele a pergunta vira "existe
      -- algum cancelamento?", que é a pergunta errada (ver `nao_estornadas`).
      pe.created_at as pago_em,
      -- Payt identifica a transação por `transaction_id`; a Kiwify por
      -- `order_id`. As duas plataformas caem na mesma tabela.
      coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') as tx
    from public.payment_events pe
    where pe.event_type in (
            'paid','approved','completed','confirmed','order_approved','subscription_renewed'
          )
      and coalesce((pe.payload->>'test')::boolean, false) = false
      and pe.buyer_email is not null
  ),
  nao_estornadas as (
    -- Estorno é sobre a TRANSAÇÃO, não sobre a compradora: quem pagou o mesmo
    -- curso numa segunda compra que continua em pé não perde nada aqui
    -- (feedback-revogacao-escopo).
    --
    -- DUAS regras estão amarradas aqui, e tirar qualquer uma quebra gente real:
    --
    -- 1. `payment_status` manda quando existe; o `event_type` só é consultado
    --    quando ele vem nulo. É o formato de `compra_estornada`, e não é
    --    firula: dos 1.818 eventos `canceled` do banco, 1.213 trazem
    --    `payment_status = 'expired'` (PIX que venceu) e 495 trazem
    --    `'refused'` (cartão negado). Nenhum dos dois é estorno — ninguém
    --    devolveu dinheiro nenhum, porque dinheiro nenhum entrou. Tratar todo
    --    `canceled` como estorno apagaria compra boa.
    -- 2. o cancelamento tem que ter vindo DEPOIS do pagamento. Quatro alunas
    --    reais — julianabohn22, luciaelenapadovan, laiszugee e ilcatc59 —
    --    tiveram o PIX vencido e pagaram no dia seguinte NO MESMO
    --    `transaction_id`: a Payt reaproveita o número. A sequência delas é
    --    `waiting_payment -> canceled -> paid`. Hoje quem as protege é a regra
    --    1 (o `canceled` delas traz `'expired'`), mas os 20 eventos com
    --    `payment_status = 'canceled'` e os 16 sem `payment_status` nenhum
    --    cairiam no segundo ramo do OR — e aí a única coisa entre elas e a
    --    exclusão é esta comparação de data.
    --
    -- Divergência conhecida: `compra_estornada` ainda não tem `canceled` na
    -- lista (só `curso_coberto_por_outra_compra` tem). Quem olhar as duas lado
    -- a lado vai achar que uma está errada — está: é a de lá.
    select p.*
    from pagas p
    where not exists (
      select 1
      from public.payment_events est
      where coalesce(est.payload->>'transaction_id', est.payload->>'order_id') = p.tx
        and est.created_at > p.pago_em
        and (
          est.payload->'transaction'->>'payment_status'
            in ('refunded','chargeback','canceled','cancelled')
          or (est.payload->'transaction'->>'payment_status' is null
              -- `subscription_canceled` e `subscription_late` entram porque
              -- estão em REVOKE_EVENTS (kiwify.ts:142): os dois cortam acesso
              -- pelo webhook. Sem eles, o botão devolveria na mão o acesso que
              -- o cancelamento da assinatura tinha acabado de tirar.
              and est.event_type in (
                    'refunded','order_refunded','chargeback','chargedback',
                    'canceled','cancelled',
                    'subscription_canceled','subscription_late'
                  ))
        )
    )
  ),
  codigos as (
    -- Espelha `extractProductCodes` (payt.ts:156) e `extractKiwifyProductCodes`
    -- (kiwify.ts:127): produto agrupado entrega os ITENS, nunca o código do
    -- grupo; order bump entra; e a Kiwify identifica o produto por
    -- `Product.product_id`, por `product_id` na raiz ou pelo id do plano da
    -- assinatura — nunca por `product.code`.
    select p.em, z.cod
    from nao_estornadas p
    cross join lateral (
      select case
               when p.pl->'product'->>'type' = 'grouped'
                and jsonb_array_length(coalesce(p.pl->'product'->'items','[]'::jsonb)) > 0
               then null
               else p.pl->'product'->>'code'
             end as cod
      union all
      select x->>'code'
        from jsonb_array_elements(coalesce(p.pl->'product'->'items','[]'::jsonb)) x
       where p.pl->'product'->>'type' = 'grouped'
      union all
      select b->'product'->>'code'
        from jsonb_array_elements(coalesce(p.pl->'order_bumps','[]'::jsonb)) b
       where coalesce(b->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(b->'product'->'items','[]'::jsonb)) = 0
      union all
      select w->>'code'
        from jsonb_array_elements(coalesce(p.pl->'order_bumps','[]'::jsonb)) b,
             jsonb_array_elements(coalesce(b->'product'->'items','[]'::jsonb)) w
       where b->'product'->>'type' = 'grouped'
      union all
      select p.pl->'Product'->>'product_id'
      union all
      select p.pl->>'product_id'
      union all
      -- Terceiro ramo da Kiwify. Das 27 compras Kiwify do banco, 10 trazem
      -- este campo; hoje o id de plano que aparece (6516201f-…) não está em
      -- `checkout_codes` de curso nenhum, então esta linha não muda o
      -- resultado AINDA. Ela existe para o dia em que a admin cadastrar o
      -- plano da assinatura como código do curso — é o que o webhook já faz, e
      -- o reparo tem que enxergar a mesma compra que o webhook enxerga.
      select p.pl->'Subscription'->'plan'->>'id'
    ) z
    where z.cod is not null
  ),
  compradoras as (
    select distinct k.em
    from codigos k
    join public.courses c on c.id = p_course_id
    where exists (
            -- `lower()` dos dois lados: os UUID da Kiwify circulam nas duas
            -- caixas (o mesmo motivo de `caseVariants()` existir em
            -- process-purchase.ts). Hoje não perde ninguém; é para não passar
            -- a perder.
            select 1 from unnest(c.checkout_codes) cc where lower(cc) = lower(k.cod)
          )
       -- Paridade com o webhook, que matricula todo curso `in_plan` na compra
       -- do plano (process-purchase.ts:443-465).
       or (public.is_plan_code(k.cod) and c.in_plan)
  )
  select pr.id, pr.email
  from compradoras cm
  join public.profiles pr on lower(pr.email) = cm.em
  -- A lista é de ALUNAS. A admin comprou no checkout para testar (Workshop
  -- Buquê de Velas, 02/07) e por isso entrava aqui; matriculá-la sujaria a
  -- contagem de matrículas do curso e a taxa de conclusão. E quem foi banida
  -- da plataforma não volta por um clique de reparo — a decisão de desbanir é
  -- outra, e é da Jessica. `banned` é NOT NULL, então a comparação direta basta.
  where pr.role <> 'admin'
    and pr.banned = false
    and not exists (
      -- Matrícula revogada escreve `expires_at = agora` (process-purchase.ts:347).
      -- Quem foi revogada e recomprou tem que voltar a entrar na lista; o filtro
      -- de estorno acima é o que impede isso de devolver acesso devolvido.
      select 1
      from public.enrollments e
      where e.user_id = pr.id
        and e.course_id = p_course_id
        and (e.expires_at is null or e.expires_at > now())
    )
  -- `order by` + `limit` são obrigatórios: sem ordem, um corte pega linhas
  -- arbitrárias (feedback-postgrest-corta-em-1000). 500 fica abaixo do teto de
  -- 1.000 do PostgREST, então o retorno nunca vem truncado em silêncio — e a
  -- action avisa quando bate no limite, para a admin clicar de novo.
  order by pr.id
  limit p_limite;
$$;

comment on function public.alunas_para_matricula_retroativa(uuid, integer) is
  'Alunas com compra paga e não estornada deste curso e sem matrícula ativa. Extração de códigos igual à do webhook; estorno só conta quando vem depois do pagamento; admin e banida ficam de fora.';

-- A função é `security definer` e lê `payment_events` inteiro: só o service
-- role chama. Revogar de PUBLIC é o que de fato fecha a porta — revogar só de
-- anon/authenticated não adianta, porque os dois herdam o grant de PUBLIC.
-- E por isso o grant abaixo é obrigatório: sem ele a própria action do admin
-- bate em "permission denied" e o botão fica quebrado.
-- Assinatura conferida com pg_get_function_identity_arguments: `uuid, integer`.
-- Assinatura errada não dá erro — o revoke simplesmente não casa com nada.
revoke all on function public.alunas_para_matricula_retroativa(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.alunas_para_matricula_retroativa(uuid, integer)
  to service_role;

-- CONFERIR depois de aplicar:
--   select proname, proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname = 'alunas_para_matricula_retroativa';
-- Não pode haver '=X/' no proacl (seria o grant de PUBLIC ainda de pé).
