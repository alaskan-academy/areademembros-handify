-- ─── O índice de telefone existia e o webhook não conseguia usar ───────────
--
-- Os dois índices criados em `20260912_vincular_compra_por_telefone.sql` são
-- PARCIAIS, com `where ... and length(phone_norm) >= 10`. Um índice parcial só
-- serve a consulta cuja condição o Postgres consiga PROVAR que implica o
-- predicado. `phone_norm = '11999999999'` implica `phone_norm is not null` — isso
-- ele prova. Mas não prova `length(phone_norm) >= 10`: o planejador não sai
-- avaliando `length()` do literal para casar com predicado de índice.
--
-- Resultado: toda busca por igualdade caía em varredura completa. Medido em
-- 26/09/2026, com EXPLAIN em produção:
--
--   select ... from profiles where phone_norm = '...' and role <> 'admin' limit 5
--     Seq Scan on profiles ........................ 4,98 ms
--     Rows Removed by Filter: 4.793   Buffers: shared hit=241
--
-- E não é uma tela: é `contaDaMesmaPessoa` (src/lib/auth/vincular-compra.ts:210)
-- e a busca em `activation_tokens` (mesma função, linha 144) — o caminho que
-- liga a compra à pessoa pelo telefone quando ela erra o próprio e-mail. Roda em
-- TODO webhook de compra e em TODO cadastro. Em `activation_tokens` são 13.580
-- linhas varridas por vez.
--
-- Os índices não estavam ociosos por acaso: `profiles_phone_norm_idx` tem 38
-- varreduras e `activation_tokens_phone_norm_idx` tem 1. Quem os usa é
-- `public.compras_sem_acesso()`, a única função que repete o `length(...) >= 10`
-- e por isso casa com o predicado. Essa função continua funcionando igual — um
-- índice cheio atende de sobra uma consulta que ainda filtra por comprimento.
--
-- ── O que muda ─────────────────────────────────────────────────────────────
--
-- Sai o `length(...) >= 10`, fica o `is not null`. O `is not null` pode ficar
-- porque a igualdade o implica, então ele não atrapalha e ainda mantém o índice
-- menor (na base de hoje, 23 perfis têm telefone nulo).
--
-- A guarda de "telefone curto não identifica ninguém" NÃO morava no índice e
-- continua onde sempre esteve: `telefoneUtilizavel` em
-- src/lib/auth/vincular-compra.ts:35. Índice é caminho de leitura, não regra de
-- negócio — e usar um para valer o outro foi o que escondeu este custo por
-- duas semanas.
--
-- Tabelas de 4.793 e 13.580 linhas: a reconstrução é de milissegundos, por isso
-- sem `concurrently` (que também não roda dentro de transação de migration).

drop index if exists public.profiles_phone_norm_idx;
create index profiles_phone_norm_idx
  on public.profiles (phone_norm)
  where phone_norm is not null;

drop index if exists public.activation_tokens_phone_norm_idx;
create index activation_tokens_phone_norm_idx
  on public.activation_tokens (buyer_phone_norm)
  where buyer_phone_norm is not null;
