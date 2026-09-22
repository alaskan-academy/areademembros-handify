-- ─── APLICAR SÓ DEPOIS DO DEPLOY ────────────────────────────────────────────
--
-- Repara a campanha "Ferramentas novas na Handify" (05/09/2026): ela alcançou
-- 1.000 de ~3.474 alunas e ficou gravada como "enviada". O status certo é
-- 'parcial'.
--
-- POR QUE ISTO NÃO PODE RODAR ANTES DO DEPLOY:
--
-- O código que está em produção hoje recusa o disparo apenas quando o status é
-- 'sent' ou 'cancelled'. 'parcial' não está na lista — e `dispatchCampaign`
-- ainda é Server Action exportada sem `requireAdmin`, isto é, um endpoint POST
-- que qualquer visitante alcança. Enquanto o código velho estiver no ar, o
-- 'sent' é a única coisa segurando essa linha. Trocá-lo por 'parcial' abriria
-- a porta para um redisparo às 4.571 alunas ativas, e as 1.000 que já
-- receberam levariam notificação e push em duplicata — `notifications` não tem
-- dedupe para desfazer.
--
-- Depois do deploy a porta está fechada por dois lados: o invólucro público
-- exige admin, e o painel só oferece "Enviar agora" para 'scheduled'.
--
-- CONFERIR ANTES de rodar (as duas coisas precisam ser verdade):
--   1. o deploy com src/lib/notifications/dispatch.ts está no ar;
--   2. select count(*) from public.notifications
--       where title = 'Ferramentas novas na Handify 🧰';   -- tem que dar 1000

update public.notification_campaigns
   set status = 'parcial'
 where id = '148aca7b-3e11-4945-83f4-6f0f6327b667'
   and status = 'sent';

-- CONFERIR DEPOIS: a contagem de notificações tem que continuar 1000. Se virar
-- 4571 ou 5571, a campanha foi redisparada — reverter na hora com
--   update public.notification_campaigns set status = 'sent'
--    where id = '148aca7b-3e11-4945-83f4-6f0f6327b667';
--
-- Efeito colateral esperado no painel: o card "Campanhas enviadas" cai de 3
-- para 2, porque ele conta só status='sent'. É o comportamento pretendido.
