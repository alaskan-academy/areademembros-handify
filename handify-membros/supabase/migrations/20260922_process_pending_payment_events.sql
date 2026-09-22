-- ─── A rede de segurança do cadastro entregava a compra pela metade ─────────
--
-- process_pending_payment_events é o que roda quando a aluna cria a conta
-- depois de ter pago: handle_new_user a chama dentro do insert em auth.users,
-- dentro de um begin/exception que transforma qualquer falha em warning. É a
-- última chance de quem pagou antes de existir conta. Conferido de novo em
-- 22/09/2026: o único chamador é esse gatilho (005_triggers.sql). Nenhuma linha
-- de TypeScript chama esta função — o que ela deixar passar, ninguém repete.
--
-- Ela procurava curso só por payment_events.product_code, que guarda apenas o
-- código PRINCIPAL da compra (process-purchase.ts:53). Item de produto agrupado
-- e order bump vivem em payload->product->items e payload->order_bumps, e a
-- função nunca abria o payload. Remedido em 22/09/2026, sobre os 5.037 eventos
-- pagos do banco: 4.990 batem em algum curso, e em 1.891 deles o código
-- principal entrega MENOS do que a compra inteira — 1.815 e-mails distintos,
-- 6.381 matrículas a menos.
--
-- Na direção contrária são 26 eventos, todos agrupados da Payt, que passam a
-- entregar UM curso a menos cada: é o brinde que o código do grupo dava e o
-- pacote não incluía. Perder esse curso é o conserto, não o efeito colateral.
--
-- No combo o código principal é o código do GRUPO (payt/route.ts:42), e o grupo
-- não serve de chave aqui: ou não acha curso nenhum, ou acha demais. São 46
-- compras agrupadas pagas no banco — 45 com o código L9QEPN (Kit Completo) e
-- uma de teste. L9QEPN está no checkout_codes de quatro cursos enquanto o
-- pacote entrega três, e usá-lo daria "Curso Vendas no Artesanato na Prática"
-- de brinde: são exatamente as 26 compras contadas acima, aquelas em que esse
-- quarto curso não veio por nenhum item nem order bump da mesma compra. Foi
-- esse código que, numa varredura de 13/09, inchou a lista de alunas sem
-- matrícula de 46 para 94.
-- Grupo entrega os ITENS, como faz extractProductCodes (payt.ts:156) — é dessa
-- função que a extração abaixo é cópia, e ela nunca usa o código do grupo.
--
-- E bastava UM curso entrar no laço para o evento virar processed = true: o
-- resto da compra se perdia sem erro, invisível no painel de webhooks. Uma
-- aluna de combo de seis cursos sairia com um, e nada apontaria para isso.
--
-- Faltava ainda a pergunta do estorno, que o caminho equivalente em TypeScript
-- faz e este não fazia: quem pagou, estornou e criou conta depois ganhava acesso.
--
-- Ninguém está machucado hoje: a fila que ela lê (pago + processed=false +
-- error null) está vazia — 5.407 eventos pendentes em 22/09/2026, nenhum deles
-- de pagamento —, porque o webhook resolve antes criando activation_tokens. O
-- defeito é bomba armada: a primeira linha que cair naquela fila entra pela
-- metade e sai marcada como concluída.
--
-- Nada de backfill: a correção é só a definição da função, que passa a agir
-- sozinha no próximo cadastro. Rodar sobre a fila atual concederia matrícula em
-- massa, e matrícula alimenta os crons de e-mail.
--
-- ─── Revisão de 22/09/2026: quatro consertos sobre a versão acima ────────────
--
-- 1. A pergunta do estorno era CÓDIGO MORTO PARA A KIWIFY INTEIRA. Ela só
--    disparava quando payload->>'transaction_id' existia, e a Kiwify não usa
--    esse campo: dos 61 eventos dela no banco, 61 têm order_id e ZERO têm
--    transaction_id (27 são de pagamento — 22 order_approved + 5
--    subscription_renewed). Quem comprasse pela Kiwify, pedisse reembolso e
--    criasse a conta depois entrava com acesso liberado. Agora a chave é
--    coalesce(transaction_id, order_id), que é a mesma transação nas duas
--    plataformas. Hoje os 12.950 eventos do banco têm uma das duas: nenhum
--    fica sem chave.
--
--    Trocar a chave na CHAMADA não bastaria: public.compra_estornada filtra
--    `payload->>'transaction_id' is not null` dentro dela, então passar o
--    order_id devolveria false do mesmo jeito. Por isso a regra do estorno foi
--    trazida para dentro desta função (ver ponto 4) em vez de chamar aquela.
--
-- 2. O caminho `canceled` da Payt (paid -> refund_requested -> canceled) NÃO
--    estava descoberto, ao contrário do que a revisão apontou — compra_estornada
--    lê transaction.payment_status desde 13/09 e é justamente por ele que o
--    estorno da Payt aparece. Conferido nas 6.786 transações da Payt: 75
--    estornos detectados, 74 deles pelo par canceled + payment_status=refunded,
--    e ZERO transações com canceled+refunded passando despercebidas. A regra
--    copiada abaixo mantém as duas exigências que fazem isso funcionar: a prova
--    é o payment_status (canceled sozinho é PIX vencido, foi o que tirou o
--    acesso pago de 24 alunas em 09/09) e o estorno tem que vir DEPOIS do
--    pagamento.
--
-- 3. Erro em evento é PORTA DE SAÍDA, não bilhete de volta: o laço filtra
--    `error is null` e o único chamador roda uma vez, no insert em auth.users.
--    Escrever erro na entrega parcial enterrava a compra — a aluna ficava com
--    dois cursos de seis e a linha nunca mais era olhada por ninguém. Agora a
--    entrega parcial NÃO escreve nada: o evento fica pendente e refazível, e
--    quem denuncia é o relatório diário (compras_sem_acesso pelos
--    activation_tokens, acesso_revogado_mas_pago quando a matrícula existe mas
--    está revogada). Só o estorno escreve erro, porque ali a decisão é não
--    entregar — e mesmo essa é reversível à mão com
--    `update payment_events set error = null where id = ...`.
--
-- 4. CUSTO: isto roda DENTRO da transação que cria a aluna. compra_estornada
--    faz Seq Scan em payment_events (31 MB, 12.950 linhas; não há índice em
--    lower(buyer_email) — só idx_payment_events_pending, sobre buyer_email cru)
--    e era chamada UMA VEZ POR EVENTO da fila: a revisão mediu ~213 ms e 43.690
--    buffers por chamada. Cadastro de quem tem cinco eventos pendentes pagava
--    cinco varreduras da tabela inteira antes de a conta existir. Agora os
--    eventos e as transações estornadas saem da MESMA varredura (CTE
--    materializada): EXPLAIN mostra um único Seq Scan por chamada, custo ~1.727,
--    independente de quantos eventos a fila tenha.
create or replace function public.process_pending_payment_events(p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event   record;
  v_course  record;
  v_user_id uuid;
  v_codigos text[];
  v_cursos  uuid[];
  v_falta   text[];
  v_source  public.enrollment_source;
begin
  select id into v_user_id
  from public.profiles
  where lower(email) = lower(p_email)
  limit 1;

  if v_user_id is null then return; end if;

  -- (A) Uma varredura só: a fila desta aluna E as transações dela que voltaram
  -- atrás. `meus` é materializada de propósito — é lida duas vezes (pelo
  -- estorno e pela fila) e sem isso o planner leria payment_events de novo.
  --
  -- A chave da transação é coalesce(transaction_id, order_id): a Payt manda a
  -- primeira, a Kiwify manda a segunda, e a pergunta do estorno é sempre sobre
  -- a TRANSAÇÃO, nunca sobre a compradora — misturar as duas coisas foi o que
  -- revogou o acesso pago de 24 alunas em 09/09/2026.
  --
  -- A regra de estorno é cópia fiel de public.compra_estornada (versão de
  -- 13/09): a prova é transaction.payment_status, com o nome do evento como
  -- recurso só quando o payload não tem esse campo (caso da Kiwify). Está aqui
  -- dentro, e não como chamada, por dois motivos medidos hoje: compra_estornada
  -- é cega para a Kiwify (filtra transaction_id não nulo) e custa uma varredura
  -- da tabela por chamada. Se a regra de estorno mudar lá, muda aqui também.
  for v_event in
    with meus as materialized (
      select pe.id, pe.product_code, pe.platform, pe.payload,
             pe.processed, pe.error, pe.event_type, pe.created_at,
             coalesce(pe.payload->>'transaction_id', pe.payload->>'order_id') as chave
      from public.payment_events pe
      where lower(pe.buyer_email) = lower(p_email)
    ),
    estornadas as materialized (
      select m.chave
      from meus m
      where m.chave is not null
      group by m.chave
      having max(m.created_at) filter (
               where m.event_type in ('paid','approved','completed','confirmed',
                                      'order_approved','subscription_renewed')
             ) is not null
         -- estorno DEPOIS do pagamento; se não houve estorno o max é null e a
         -- comparação some — transação que nunca teve 'paid' é PIX abandonado
         -- e não significa nada.
         and max(m.created_at) filter (
               where m.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
                  or (m.payload->'transaction'->>'payment_status' is null
                      and m.event_type in ('refunded','order_refunded','chargeback','chargedback'))
             ) >
             max(m.created_at) filter (
               where m.event_type in ('paid','approved','completed','confirmed',
                                      'order_approved','subscription_renewed')
             )
    )
    select m.id, m.product_code, m.platform, m.payload,
           -- sem chave nenhuma não dá para perguntar; hoje não existe evento
           -- assim (12.950 de 12.950 têm transaction_id ou order_id).
           (m.chave is not null and m.chave in (select chave from estornadas)) as estornada
    from meus m
    where m.processed = false
      and m.error is null
      and m.event_type in (
        'paid', 'approved', 'completed', 'confirmed',   -- Payt
        'order_approved', 'subscription_renewed'        -- Kiwify
      )
    order by m.created_at
  loop
    -- (B) Dinheiro que voltou não abre curso. Aqui o erro é proposital e
    -- terminal: é decisão de não entregar, não falha de entrega. Fica visível
    -- no painel de webhooks e fora da fila; limpar o error reabre o caso.
    if v_event.estornada then
      update public.payment_events
         set error = 'cadastro: transacao estornada, acesso nao liberado'
       where id = v_event.id;
      continue;
    end if;

    -- (C) TODOS os códigos da compra, não só o principal. Mesma expansão que
    -- codigos_vendidos_sem_curso e curso_coberto_por_outra_compra já usam, mais
    -- as linhas da Kiwify que espelham extractKiwifyProductCodes.
    -- Produto agrupado entrega os ITENS, nunca o código do grupo: o grupo está
    -- cadastrado em cursos que o pacote não inclui e daria curso de brinde.
    -- Conferido em 22/09/2026 sobre os 5.037 eventos pagos do banco: o conjunto
    -- de cursos que sai daqui é igual, evento a evento, ao que o webhook entrega.
    select array_agg(distinct lower(z.cod)) into v_codigos
    from (
      -- Coluna product_code: única fonte que a Kiwify preenche (o payload dela
      -- não tem 'product' minúsculo, então o case cai no else e o código entra).
      -- Na Payt agrupada essa coluna guarda o código do GRUPO, e o grupo não é
      -- curso: entra null e quem responde são os itens, logo abaixo.
      select case when v_event.payload->'product'->>'type' = 'grouped'
                   and jsonb_array_length(
                         case when jsonb_typeof(v_event.payload->'product'->'items') = 'array'
                              then v_event.payload->'product'->'items' else '[]'::jsonb end) > 0
                  then null
                  else v_event.product_code end as cod
      union all
      -- produto simples (no agrupado, o código do grupo não vale)
      select case when v_event.payload->'product'->>'type' = 'grouped'
                   and jsonb_array_length(
                         case when jsonb_typeof(v_event.payload->'product'->'items') = 'array'
                              then v_event.payload->'product'->'items' else '[]'::jsonb end) > 0
                  then null
                  else v_event.payload->'product'->>'code' end
      union all
      -- itens do produto agrupado
      select x->>'code'
        from jsonb_array_elements(
               case when jsonb_typeof(v_event.payload->'product'->'items') = 'array'
                    then v_event.payload->'product'->'items' else '[]'::jsonb end) x
       where v_event.payload->'product'->>'type' = 'grouped'
      union all
      -- bump simples
      select b->'product'->>'code'
        from jsonb_array_elements(
               case when jsonb_typeof(v_event.payload->'order_bumps') = 'array'
                    then v_event.payload->'order_bumps' else '[]'::jsonb end) b
       where coalesce(b->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(
               case when jsonb_typeof(b->'product'->'items') = 'array'
                    then b->'product'->'items' else '[]'::jsonb end) = 0
      union all
      -- itens do bump agrupado
      select w->>'code'
        from jsonb_array_elements(
               case when jsonb_typeof(v_event.payload->'order_bumps') = 'array'
                    then v_event.payload->'order_bumps' else '[]'::jsonb end) b,
             jsonb_array_elements(
               case when jsonb_typeof(b->'product'->'items') = 'array'
                    then b->'product'->'items' else '[]'::jsonb end) w
       where b->'product'->>'type' = 'grouped'
      -- Kiwify: produto, o mesmo id repetido na raiz em alguns payloads, e o
      -- plano da assinatura. As três fontes de extractKiwifyProductCodes.
      union all select v_event.payload->'Product'->>'product_id'
      union all select v_event.payload->>'product_id'
      union all select v_event.payload->'Subscription'->'plan'->>'id'
    ) z
    where z.cod is not null and z.cod <> '';

    -- Evento sem código nenhum: fica pendente de propósito, sem erro. Escrever
    -- erro aqui tiraria a linha da fila para sempre (ver ponto 3 do cabeçalho).
    if v_codigos is null then continue; end if;

    -- Cast defensivo: platform desconhecida derrubaria a função inteira, e
    -- handle_new_user engole a exceção num warning que ninguém lê.
    v_source := case when lower(coalesce(v_event.platform, '')) = 'kiwify'
                     then 'kiwify' else 'payt' end::public.enrollment_source;

    select array_agg(c.id) into v_cursos
    from public.courses c
    where exists (
            select 1 from unnest(c.checkout_codes) code
            where lower(code) = any (v_codigos)
          )
       or (c.in_plan and exists (
            select 1 from unnest(v_codigos) k where public.is_plan_code(k)
          ));

    -- Nenhum código cadastrado como curso: não é erro desta função, e também
    -- não é motivo para enterrar o evento. codigos_vendidos_sem_curso já alarma
    -- esse caso, e o dia em que a admin cadastrar o código a linha ainda está lá.
    if v_cursos is null then continue; end if;

    for v_course in
      select c.id, c.access_days from public.courses c where c.id = any (v_cursos)
    loop
      insert into public.enrollments (user_id, course_id, source, granted_at, expires_at)
      values (
        v_user_id,
        v_course.id,
        v_source,
        now(),
        case when v_course.access_days is null then null
             else now() + (v_course.access_days || ' days')::interval end
      )
      on conflict (user_id, course_id) do nothing;
    end loop;

    -- (D) Só dá a compra por entregue quando TODO curso dela tem matrícula
    -- viva. Antes, um curso de seis bastava para marcar processed = true.
    select array_agg(cid::text) into v_falta
    from unnest(v_cursos) cid
    where not exists (
      select 1 from public.enrollments e
      where e.user_id = v_user_id
        and e.course_id = cid
        and (e.expires_at is null or e.expires_at > now())
    );

    if v_falta is null then
      update public.payment_events set processed = true where id = v_event.id;
    end if;
    -- Faltou curso? A linha fica como está: pendente, sem erro, refazível.
    --
    -- O caso real de falta é matrícula que EXISTE mas está revogada (o insert
    -- acima é `do nothing`, e revogação é expires_at no passado — 315 linhas
    -- assim hoje). Reativar sozinha, dentro do cadastro, seria decidir acesso
    -- pago no escuro; quem levanta isso é acesso_revogado_mas_pago, no relatório
    -- diário, que lista exatamente "alguém pagou e está sem acesso".
  end loop;

  -- Fica: é ele que cria a membership de quem comprou o plano antes de ter conta.
  --
  -- ASSIMETRIA CONHECIDA, de propósito fora desta migration: o laço acima já
  -- enxerga o código do plano vindo de item de agrupado ou de order bump (é
  -- assim que os 23 cursos in_plan entram), mas sync_membership_from_payments
  -- só olha a coluna product_code. Se um dia o plano for vendido como item de
  -- combo, a aluna sai com os 23 cursos e SEM a linha em memberships — ou seja,
  -- sem Handify Completo para as campanhas e para has_active_membership.
  -- Medido em 22/09/2026: dos 5.019 eventos pagos reais, 109 carregam código de
  -- plano e em TODOS ele está na coluna product_code. Zero pessoas afetadas
  -- hoje. O conserto é na outra função (expandir os códigos como aqui), e ela
  -- precisa da mesma viagem para a regra de estorno dela, que ainda é a antiga,
  -- por event_type, e trata 'canceled' de PIX vencido como reembolso.
  perform public.sync_membership_from_payments(v_user_id);
end;
$function$;

-- Continua fechada para a API: só handle_new_user a chama, como SECURITY DEFINER.
--
-- `revoke ... from anon, authenticated` NÃO fecha função nenhuma — os dois
-- papéis herdam EXECUTE de PUBLIC, e é de PUBLIC que precisa sair. Foi assim
-- que alunas_para_reengajar respondeu 900 e-mails à chave anônima em 22/09.
-- Assinatura conferida com pg_get_function_identity_arguments: `p_email text`.
revoke all on function public.process_pending_payment_events(text) from public;
grant execute on function public.process_pending_payment_events(text) to service_role;

-- CONFERIR depois de aplicar:
--   select proname, proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname = 'process_pending_payment_events';
--   -- esperado: {postgres=X/postgres,service_role=X/postgres} — nenhum '=X/' solto.
