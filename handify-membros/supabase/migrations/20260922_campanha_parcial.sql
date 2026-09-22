-- ─── Campanha que saiu pela metade ──────────────────────────────────────────
--
-- 'parcial' é o status de uma campanha que alcançou parte do público. O valor
-- já foi aplicado direto em produção em 22/09/2026; esta migration existe para
-- o repo conseguir reconstruir o banco. Sem ela, em ambiente novo (ou depois de
-- um `db reset`) o CHECK recusa o UPDATE final do dispatcher — e como esse erro
-- ficava sem ser lido, a campanha que entregou tudo ficava gravada como
-- "sending" com sent_count 0, para sempre.
alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_status_check;
alter table public.notification_campaigns
  add constraint notification_campaigns_status_check
  check (status in ('draft','scheduled','sending','sent','parcial','cancelled'));

-- Quantas alunas a campanha DEVERIA ter alcançado. Sem isso, "1.000 enviadas"
-- no painel não diz se foi a base inteira ou um quinto dela.
alter table public.notification_campaigns
  add column if not exists target_count integer;

comment on column public.notification_campaigns.target_count is
  'Tamanho do público alvo no momento do disparo. NULL nas campanhas anteriores a 22/09/2026.';

-- O reparo da linha de 05/09/2026 NÃO mora mais aqui. Ele foi para
-- 20260922_campanha_parcial_reparo.sql, que só pode rodar DEPOIS do deploy.
--
-- Por quê: o código que está em produção agora recusa apenas 'sent' e
-- 'cancelled'. 'parcial' passa reto — e `dispatchCampaign` ainda é Server
-- Action exportada sem requireAdmin, ou seja, endpoint POST aberto. Hoje o que
-- protege aquela linha de ser redisparada para as 4.571 alunas é justamente
-- ela estar como 'sent'. Marcar 'parcial' antes do deploy abriria essa porta,
-- e as 1.000 que já receberam levariam tudo em duplicata: `notifications` não
-- tem dedupe.
--
-- Este arquivo, sozinho, é só DDL: pode e deve ir antes do deploy, junto com
-- 20260922_dispatch_campanha_trava.sql — as duas são um par, porque o código
-- novo grava `target_count` (aqui) e `sending_since` (lá) no mesmo UPDATE.
