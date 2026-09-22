-- ─── A trava pergunta pela PESSOA, não pelo e-mail da compra ─────────────────
--
-- A proteção de 22/09 decidiu "revoga o quê": um curso só cai quando NENHUMA
-- compra em pé o cobre. Mas ela procura as outras compras por `buyer_email`, e
-- quem comprou com dois endereços tem as compras espalhadas. A Cândida pagou
-- RW2MMP em 02/08 com candidaalvarenga13@gmail.com e 4MJ9YD em 13/09 com
-- ...@gamil.com (typo); o webhook ligou as duas na mesma conta pelo telefone e
-- gravou em audit_log. Um estorno de qualquer uma não enxerga a outra.
--
-- Concede-se por pessoa (contaDaMesmaPessoa / compraDeOutroEmail) e protegia-se
-- por e-mail. Esta migration fecha a assimetria com a MESMA regra de identidade
-- que concede: CPF sozinho, ou telefone + primeiro nome. Nunca telefone
-- sozinho — casal e família dividem número.
--
-- Varredura de 22/09: 14 pessoas com compras pagas em 2 e-mails, nenhuma com
-- estorno ainda. É prevenção, não conserto — não há backfill a fazer.
--
-- CPF compartilhado, o que a regra assume: 45 CPFs aparecem em mais de um
-- e-mail; em 3 deles os nomes são de pessoas diferentes (a família Ponce,
-- hzpdp@gmail.com/Hemerson e hzpdp1969@gmail.com/Hida, comprou com o mesmo
-- documento). Esses 3 vão fundir. Aqui isso só faz a trava PROTEGER um curso
-- que talvez devesse cair — acesso a mais, que a admin tira num clique. É o
-- oposto do lado da concessão, onde fundir errado entrega curso para outra
-- pessoa; por isso lá `contaDaMesmaPessoa` exige CPF em uma conta só.
--
-- ─── Revisão adversarial de 22/09: os cinco defeitos eram reais ──────────────
-- Cinco apontamentos vieram da revisão; conferi um a um no banco de produção,
-- nenhum caiu. O que cada um quebrava, e para quem, está escrito junto do
-- trecho que mudou:
--
--   1. O revoke não fechava função nenhuma  → CRÍTICO, mesmo vazamento de hoje
--   2. Os índices não serviam à busca que justificava criá-los  → confirmado
--   3. Telefone de uma compra casava com o nome de OUTRA  → confirmado
--   4. primeiro_nome_comparavel não espelhava o TS  → confirmado
--   5. Os três índices travam escrita em payment_events  → confirmado, 0,6 s
--
-- Nenhum dos cinco estava errado. O que mudou em relação ao que a revisão
-- pediu: no item 1 o conserto que ela sugeriu (só `from public`) ainda deixa a
-- função aberta para anon e authenticated neste projeto — ver o bloco de
-- permissões no fim do arquivo.

-- ─── Defeito 4: o comentário mentia sobre espelhar o TypeScript ──────────────
--
-- A versão anterior usava translate() + split_part(' ') e dizia "espelha
-- mesmoPrimeiroNome()". Não espelhava, em três pontos:
--
--   a) split_part(x, ' ', 1) corta só no ESPAÇO. O TS corta em /\s+/. Nome
--      colado com TAB ou com espaço-duro (U+00A0, o que o iPhone insere ao
--      autocompletar) virava "andrea\tmaria" aqui e "andrea" lá — a mesma
--      pessoa deixava de casar consigo mesma.
--   b) translate() só conhece a lista de acentos latinos escrita à mão, e só
--      na forma pré-composta. Nome digitado em NFD (decomposto, como o macOS
--      grava) passava com o acento inteiro.
--   c) O TS recusa primeiro nome de UMA letra ("A Silva" não identifica
--      ninguém). A função devolvia 'a' e quem segurava a regra era um
--      `length(nome) >= 2` na CTE de fora — protegendo só um dos dois lados
--      da comparação.
--
-- Agora é normalize(NFD) + tira os combinantes + primeiro pedaço não-branco,
-- que é literalmente o que o TS faz, e o corte de 2 letras mora DENTRO da
-- função, onde vale para os dois lados sem ninguém precisar lembrar.
--
-- Medido antes de trocar: nas 12.890 compras reais de hoje as duas versões dão
-- exatamente o mesmo resultado (0 divergências) e nenhum primeiro nome tem uma
-- letra só. A troca não mexe em nada que já está no banco — fecha o buraco
-- antes de a primeira Ândrea com TAB no nome aparecer.
--
-- Onde ainda difere do TS, de propósito: o TS tira TODA marca Unicode
-- (\p{M}); aqui a faixa é U+0300–U+036F, o bloco de combinantes que o NFD
-- produz para alfabeto latino. Para nome brasileiro é a mesma coisa; o regex
-- do Postgres não tem classe de propriedade Unicode para escrever o resto.
--
-- A faixa é montada com chr(768) e chr(879), e não escrita como '[̀-...]'
-- nem com os combinantes de verdade dentro do colchete, por um motivo chato e
-- concreto: o combinante colado depois do '[' fica INVISÍVEL num editor (ele
-- se desenha em cima do colchete), e a escapada \u some quando o arquivo passa
-- por ferramenta que come barra invertida. chr() é imutável, sobrevive a
-- copiar e colar, e diz o número na cara. Não mude para a forma "bonita".
create or replace function public.primeiro_nome_comparavel(bruto text)
returns text
language sql
immutable
as $$
  select case when length(v.n) >= 2 then v.n end
  from (
    select (regexp_match(
              lower(regexp_replace(normalize(coalesce(bruto, ''), NFD),
                                   '[' || chr(768) || '-' || chr(879) || ']', '', 'g')),
              '\S+'
           ))[1] as n
  ) v;
$$;

comment on function public.primeiro_nome_comparavel(text) is
  'Primeiro nome sem acento, sem caixa e sem espaço, ou NULL quando tem menos de 2 letras. Espelha mesmoPrimeiroNome() de src/lib/auth/vincular-compra.ts, inclusive o corte de 2 letras; difere só na faixa de combinantes (U+0300-U+036F, não \p{M}).';

-- Conjunto de e-mails que pertencem à mesma pessoa deste e-mail.
create or replace function public.emails_da_pessoa(p_email text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with seed as (select lower(btrim(p_email)) as email),
  -- CPF, telefone e nome de CADA compra do e-mail semente — uma linha por
  -- compra, com os três campos juntos. Ver o defeito 3, logo abaixo.
  base as (
    select
      regexp_replace(coalesce(pe.payload->'customer'->>'doc',
                              pe.payload->'Customer'->>'CPF',
                              pe.payload->'Customer'->>'cpf', ''), '\D', '', 'g') as doc,
      public.telefone_comparavel(coalesce(pe.payload->'customer'->>'phone',
                                          pe.payload->'Customer'->>'mobile',
                                          pe.payload->'Customer'->>'phone')) as fone,
      public.primeiro_nome_comparavel(pe.buyer_name) as nome
    from public.payment_events pe, seed s
    where lower(pe.buyer_email) = s.email
      and coalesce((pe.payload->>'test')::boolean, false) = false
  ),
  -- CPF sozinho já é prova: é o único campo que identifica uma pessoa.
  docs as (select distinct b.doc from base b where length(b.doc) = 11),
  --
  -- ─── Defeito 3: o par telefone+nome estava sendo desmontado ───────────────
  -- A versão anterior guardava `fones` e `nomes` em conjuntos SEPARADOS. Com
  -- isso o telefone da compra A casava com o primeiro nome da compra B, e a
  -- regra "telefone + primeiro nome" — que existe justamente para NÃO fundir
  -- casal e família no mesmo número — passava a aceitar um par que nunca
  -- apareceu em compra nenhuma.
  --
  -- Dois e-mails reais estão exatamente nessa forma hoje: ezil.edi@gmail.com
  -- (dois telefones, nomes "ezil" e "edimirson") e recantobluebutterfly@gmail.com
  -- ("bianca" e "sirlei"). São os dois casos de casal/família que a regra foi
  -- escrita para recusar, e eram os dois que o cruzamento afrouxava primeiro.
  --
  -- Medido: hoje o cruzamento não traz nenhum e-mail a mais (0 de 100 ligações
  -- mudam). Não é conserto de estrago — é fechar a porta antes de o primeiro
  -- "edimirson" com o telefone da "ezil" comprar.
  pares as (
    select distinct b.fone, b.nome
    from base b
    where length(b.fone) >= 10
      and b.nome is not null        -- primeiro_nome_comparavel já corta < 2 letras
  ),
  --
  -- ─── Defeito 2: uma CTE com OR não usa índice nenhum ──────────────────────
  -- Antes os dois caminhos (CPF, e telefone+nome) estavam num único
  -- `where ... or ...`. Medido com EXPLAIN em produção: o plano vira
  --
  --     Seq Scan on payment_events
  --       Filter: (... = (hashed SubPlan 2).col1) OR (... (hashed SubPlan 3) ...)
  --
  -- Um SubPlan com hash é avaliado como FILTRO sobre linhas que o scan já
  -- produziu, então nenhum índice de expressão pode ser usado: os dois índices
  -- criados logo abaixo ficavam parados e o comentário que os justificava
  -- estava simplesmente errado.
  --
  -- Separando em dois CTEs sem OR, o mesmo EXPLAIN passa a mostrar JOIN em vez
  -- de SubPlan — e join contra índice de expressão o planner usa. Confirmado
  -- no mesmo banco com a forma equivalente em `profiles`, que já tem índice
  -- lower(email): vira `Nested Loop -> Index Scan using profiles_email_unico`,
  -- inclusive com uma segunda condição não indexada virando Filter (que é o
  -- caso do `nome` aqui).
  por_cpf as (
    select lower(pe.buyer_email) as email
    from public.payment_events pe
    join docs d
      on d.doc = regexp_replace(coalesce(pe.payload->'customer'->>'doc',
                                         pe.payload->'Customer'->>'CPF',
                                         pe.payload->'Customer'->>'cpf', ''), '\D', '', 'g')
    where coalesce((pe.payload->>'test')::boolean, false) = false
  ),
  -- Telefone só vale acompanhado do mesmo primeiro nome, e do MESMO par.
  por_fone_e_nome as (
    select lower(pe.buyer_email) as email
    from public.payment_events pe
    join pares p
      on p.fone = public.telefone_comparavel(coalesce(pe.payload->'customer'->>'phone',
                                                      pe.payload->'Customer'->>'mobile',
                                                      pe.payload->'Customer'->>'phone'))
     and p.nome = public.primeiro_nome_comparavel(pe.buyer_name)
    where coalesce((pe.payload->>'test')::boolean, false) = false
  ),
  -- Ligações já decididas e registradas. O webhook grava
  -- {email_da_compra, email_da_conta}; o cadastro grava
  -- {email_do_cadastro, emails_da_compra[]}. Ambos com action
  -- 'enrollment.linked_by_phone'.
  ligacoes as (
    select
      (select array_agg(distinct lower(z.e))
         from (
           select al.meta->>'email_da_compra' as e
           union all select al.meta->>'email_da_conta'
           union all select al.meta->>'email_do_cadastro'
           union all select jsonb_array_elements_text(
             case when jsonb_typeof(al.meta->'emails_da_compra') = 'array'
                  then al.meta->'emails_da_compra' else '[]'::jsonb end)
         ) z
        where z.e is not null and z.e <> '') as emails
    from public.audit_log al
    where al.action = 'enrollment.linked_by_phone'
  ),
  ligados as (
    select unnest(l.emails) as email
    from ligacoes l, seed s
    where l.emails is not null and s.email = any(l.emails)
  )
  select array(
    select distinct u.e
    from (
      select email as e from seed
      union all select email from por_cpf
      union all select email from por_fone_e_nome
      union all select email from ligados
    ) u
    where u.e is not null and u.e <> ''
  );
$$;

comment on function public.emails_da_pessoa(text) is
  'E-mails da mesma pessoa: CPF igual, ou telefone E primeiro nome vindos da MESMA compra, ou ligação já registrada em audit_log. Mesma regra de identidade que concede acesso.';

-- ─── Índices: três, um para cada busca que roda por revogação ────────────────
--
-- Sem eles cada revogação de plano faz 23 varreduras (uma por curso do plano)
-- dos 12.951 payment_events / 30 MB. Com a separação do OR feita acima, os três
-- passam a servir de fato:
--
--   buyer_email_lower → a CTE `base` e o scan principal de
--                       curso_coberto_por_outra_compra (`= any(emails)`)
--   doc               → o join de `por_cpf`
--   fone              → o join de `por_fone_e_nome` (o `nome` sobra como
--                       Filter, que é barato depois do índice estreitar)
--
-- ─── Defeito 5: estes três CREATE INDEX travam escrita ───────────────────────
-- `create index` sem CONCURRENTLY pega ShareLock em payment_events: durante a
-- construção, todo INSERT fica na fila — ou seja, webhook de compra da Payt e
-- da Kiwify esperando. CONCURRENTLY não é opção aqui porque apply_migration
-- roda tudo dentro de UMA transação, e CONCURRENTLY não pode rodar em
-- transação.
--
-- Quanto tempo a fila dura, medido em produção hoje (calcular a expressão
-- sobre as 12.951 linhas e ordenar, que é o grosso do trabalho de montar o
-- btree): 0,033 s o e-mail, 0,175 s o CPF, 0,401 s o telefone — 0,609 s
-- somados, mais a escrita do índice. Abaixo de ~2 s de escrita travada.
--
-- É pouco o bastante para aplicar em horário normal. Se a tabela crescer uma
-- ordem de grandeza, tirar estes três desta migration e rodá-los à mão, fora
-- de transação, com CONCURRENTLY.
--
-- Cuidado permanente: `payment_events_fone_idx` depende de
-- public.telefone_comparavel continuar IMMUTABLE e continuar devolvendo o
-- mesmo valor. Trocar o corpo dessa função sem REINDEX deixa o índice mentindo.
create index if not exists payment_events_buyer_email_lower_idx
  on public.payment_events (lower(buyer_email));

create index if not exists payment_events_doc_idx
  on public.payment_events (
    (regexp_replace(coalesce(payload->'customer'->>'doc',
                             payload->'Customer'->>'CPF',
                             payload->'Customer'->>'cpf', ''), '\D', '', 'g'))
  );

create index if not exists payment_events_fone_idx
  on public.payment_events (
    (public.telefone_comparavel(coalesce(payload->'customer'->>'phone',
                                         payload->'Customer'->>'mobile',
                                         payload->'Customer'->>'phone')))
  );

-- ─── A trava passa a olhar todos os e-mails da pessoa ────────────────────────
-- Corpo idêntico ao que está NO BANCO hoje (conferido com pg_get_functiondef em
-- 22/09, não com o arquivo do repo, que está desatualizado), com UMA mudança: o
-- filtro de buyer_email. Mantidos de propósito: codigo_principal (única fonte
-- que a Kiwify preenche), estorno_em < pago_em (recompra depois de estorno) e
-- 'canceled'/'cancelled' na lista de estorno.
create or replace function public.curso_coberto_por_outra_compra(
  p_email     text,
  p_course_id uuid,
  p_transacao text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with eu as (select public.emails_da_pessoa(p_email) as emails),
  tx as (
    select pe.payload->>'transaction_id' as transacao,
      max(pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ) as pago_em,
      max(pe.created_at) filter (
        where pe.payload->'transaction'->>'payment_status' in ('refunded','chargeback')
           or (pe.payload->'transaction'->>'payment_status' is null
               and pe.event_type in ('refunded','order_refunded','chargeback','chargedback','canceled','cancelled'))
      ) as estorno_em,
      (array_agg(pe.payload order by pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ))[1] as pl,
      (array_agg(pe.product_code order by pe.created_at) filter (
        where pe.event_type in ('paid','approved','completed','confirmed','order_approved','subscription_renewed')
      ))[1] as codigo_principal
    from public.payment_events pe, eu
    where lower(pe.buyer_email) = any(eu.emails)     -- <<< ÚNICA MUDANÇA
      and pe.payload->>'transaction_id' is not null
      and pe.payload->>'transaction_id' <> p_transacao
      and coalesce((pe.payload->>'test')::boolean, false) = false
    group by 1
  ),
  boas as (select * from tx where pago_em is not null and (estorno_em is null or estorno_em < pago_em)),
  codigos as (
    select z.cod from boas b cross join lateral (
      -- coluna product_code: unica fonte que a Kiwify preenche
      select b.codigo_principal as cod
      union all
      select case when b.pl->'product'->>'type' = 'grouped'
                   and jsonb_array_length(coalesce(b.pl->'product'->'items','[]'::jsonb)) > 0
                  then null else b.pl->'product'->>'code' end
      union all select x->>'code' from jsonb_array_elements(coalesce(b.pl->'product'->'items','[]'::jsonb)) x
       where b.pl->'product'->>'type' = 'grouped'
      union all select bb->'product'->>'code' from jsonb_array_elements(coalesce(b.pl->'order_bumps','[]'::jsonb)) bb
       where coalesce(bb->'product'->>'type','') <> 'grouped'
          or jsonb_array_length(coalesce(bb->'product'->'items','[]'::jsonb)) = 0
      union all select w->>'code' from jsonb_array_elements(coalesce(b.pl->'order_bumps','[]'::jsonb)) bb,
             jsonb_array_elements(coalesce(bb->'product'->'items','[]'::jsonb)) w
       where bb->'product'->>'type' = 'grouped'
    ) z where z.cod is not null
  )
  select exists (
    select 1 from public.courses co
    where co.id = p_course_id and co.checkout_codes && (select array_agg(cod) from codigos)
  );
$$;

comment on function public.curso_coberto_por_outra_compra(text, uuid, text) is
  'true quando outra compra paga e não estornada DA MESMA PESSOA (todos os e-mails dela) cobre este curso. Consultada antes de revogar.';

-- ─── Defeito 1: o revoke anterior não fechava nada ───────────────────────────
--
-- Estava escrito `revoke all ... from anon, authenticated`. É a mesma linha que
-- deixou `alunas_para_reengajar` e `compras_sem_acesso` respondendo 200 para a
-- chave anônima e listando e-mail e nome de 900 alunas hoje de manhã — o furo
-- corrigido em 20260922_funcoes_de_relatorio_fechadas.sql.
--
-- `emails_da_pessoa` é `security definer`, lê payment_events e audit_log e
-- devolve e-mails. Aberta, ela é um oráculo: manda-se um e-mail, recebe-se os
-- OUTROS e-mails da mesma pessoa. Com a chave anônima, que viaja dentro do JS
-- que todo navegador baixa, isso é a base de 4.570 alunas consultável de fora.
--
-- Por que `from public, anon, authenticated` e não só `from public`, como o
-- arquivo-modelo faz: conferido em pg_default_acl deste projeto agora,
--
--   nspname=public, objtype=f → {postgres=X, anon=X, authenticated=X, service_role=X}
--
-- Função NOVA em public nasce com grant EXPLÍCITO para anon e authenticated,
-- ALÉM do EXECUTE implícito de PUBLIC. `revoke from public` tira só a entrada
-- de PUBLIC e deixa as duas explícitas de pé.
--
-- A prova está em telefone_comparavel: a migration que a criou
-- (20260912_vincular_compra_por_telefone.sql) não tem revoke nem grant nenhum,
-- e o proacl dela hoje é
--   {=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
-- ou seja, veio de fábrica com PUBLIC (`=X/`) E com anon e authenticated
-- escritos à parte. Tirar só PUBLIC ali deixaria os outros dois.
--
-- No arquivo-modelo bastou `from public` porque aquelas funções são antigas e
-- migrations anteriores já tinham tirado anon e authenticated — é o caso de
-- acesso_revogado_mas_pago e de process_pending_payment_events, ambas limpas
-- hoje. Aqui, não: emails_da_pessoa está nascendo nesta migration.
--
-- Assinatura exata, conferida com pg_get_function_identity_arguments: revoke
-- com assinatura errada não dá erro, simplesmente não casa com função nenhuma.
revoke all on function public.emails_da_pessoa(text) from public, anon, authenticated;
grant execute on function public.emails_da_pessoa(text) to service_role;

-- curso_coberto_por_outra_compra já foi fechada em
-- 20260922_funcoes_de_relatorio_fechadas.sql, e `create or replace` preserva o
-- ACL de função existente — mas repetir aqui é o que torna este arquivo
-- correto sozinho, em banco novo (branch, staging) onde a ordem pode diferir.
revoke all on function public.curso_coberto_por_outra_compra(text, uuid, text) from public, anon, authenticated;
grant execute on function public.curso_coberto_por_outra_compra(text, uuid, text) to service_role;

-- `primeiro_nome_comparavel` fica aberta DE PROPÓSITO, pelo mesmo motivo que
-- `telefone_comparavel`: é pura — texto entra, texto sai, não toca em tabela
-- nenhuma e não é security definer. Fechar não esconde dado nenhum e mexeria
-- num caminho que hoje funciona. Se um dia ela virar `security definer` ou
-- ler alguma tabela, esta decisão cai junto.

-- CONFERIR depois de aplicar:
--
-- 1) Permissão — emails_da_pessoa não pode ter '=X/' nem 'anon=' nem
--    'authenticated=' no proacl:
--      select proname, pg_get_function_identity_arguments(oid) as args, proacl
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and proname in ('emails_da_pessoa','curso_coberto_por_outra_compra');
--    E a chamada de fora com a chave anônima tem que devolver 404 ou 401:
--      POST /rest/v1/rpc/emails_da_pessoa  {"p_email":"..."}
--
-- 2) Índices — confirmar que o planner passou mesmo a usá-los. Tem que
--    aparecer Index Scan / Bitmap Index Scan, não Seq Scan:
--      explain analyze select public.emails_da_pessoa('candidaalvarenga13@gmail.com');
--    (É a única peça que não deu para medir antes de aplicar: EXPLAIN não
--    enxerga índice que ainda não existe.) Se vier Seq Scan nos três,
--    rodar ANALYZE public.payment_events e repetir antes de concluir qualquer
--    coisa.
--
-- 3) Resultado — este e-mail tem que devolver os DOIS endereços da Cândida
--    (gmail e o gamil com typo), e estes dois têm que devolver só eles mesmos,
--    porque são casal/família dividindo e-mail:
--      select public.emails_da_pessoa('candidaalvarenga13@gmail.com');  -- 2
--      select public.emails_da_pessoa('ezil.edi@gmail.com');            -- 1
--      select public.emails_da_pessoa('recantobluebutterfly@gmail.com');-- 1
