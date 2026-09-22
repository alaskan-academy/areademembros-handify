-- ─── Trava do disparo de campanha ───────────────────────────────────────────
--
-- O dispatcher reivindica a campanha com um UPDATE ... WHERE status in
-- (draft, scheduled, parcial) — uma instrução só, então dois cliques em
-- "Enviar agora" ou o cron por cima de um envio manual não conseguem mais
-- disparar a mesma campanha duas vezes (cada aluna recebia a notificação e o
-- push em duplicata, e `notifications` não tem dedupe para desfazer).
--
-- sending_since marca quando o disparo começou. Disparo morto no timeout da
-- função da Vercel deixa a linha em "sending", e o cron só procura
-- status='scheduled': sem esta coluna a campanha ficaria presa para sempre,
-- sem botão nenhum no painel para destravar. Com ela, passados 15 minutos a
-- próxima chamada retoma.
alter table public.notification_campaigns
  add column if not exists sending_since timestamptz;

comment on column public.notification_campaigns.sending_since is
  'Início do disparo em andamento. NULL quando não está enviando.';

-- Sem backfill: hoje não há nenhuma linha em 'sending'. O terceiro ramo da
-- reivindicação (sending_since is null) cobre linha antiga, se aparecer.
-- O CHECK de status já aceita 'sending' e 'parcial' — não mexer nele aqui.
