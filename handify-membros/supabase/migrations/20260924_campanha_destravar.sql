-- ─── Destravar campanha presa em "enviando" ─────────────────────────────────
--
-- APLICAR ANTES DO DEPLOY — as duas colunas são pré-requisito do código novo,
-- e o painel quebra sem elas:
--
--   · `getCampaigns()` seleciona `sent_count_aproximado`. Coluna que não existe
--     faz o PostgREST recusar a consulta inteira, e o "Histórico de campanhas"
--     fica vazio: "Nenhuma campanha criada ainda.", com as 3 campanhas no banco.
--   · `dispararCampanha` grava `notifications.campaign_id` em cada lote. Sem a
--     coluna, todo lote é recusado e a campanha termina "parcial" com 0 — o
--     oposto do que esta mudança existe para resolver.
--
-- Esta migration é só DDL + preenchimento de uma coluna nova: não envia nada,
-- não apaga nada e não muda nenhum dado de aluna.
--
-- O QUE QUEBRAVA, E PARA QUEM
--
-- Campanha que morre no timeout da função da Vercel no meio do disparo fica com
-- status 'sending' para sempre. O cron procura só status='scheduled'
-- (src/app/api/notifications/dispatch/route.ts) e o painel não oferecia botão
-- nenhum para 'sending'. A Jessica ficava com a linha travada na tela, sem
-- saber quantas alunas já tinham recebido e sem poder fechar o assunto.
--
-- Pior: `sent_count` só é gravado no UPDATE final, que nessa queda nunca roda.
-- A campanha ficava marcada com 0 mesmo tendo alcançado milhares de alunas — e
-- não havia como recontar, porque `notifications` não guardava nenhuma
-- referência à campanha (id, user_id, type, title, body, link, read,
-- created_at).
--
-- A saída NÃO é redisparar. `notifications` não tem dedupe: reenviar manda a
-- mesma notificação e o mesmo push de novo para quem já recebeu. Com 4.708
-- alunas ativas hoje, trocar "presa" por "duplicada" é pior.

-- ── 1. A referência que faltava ─────────────────────────────────────────────
alter table public.notifications
  add column if not exists campaign_id uuid
  references public.notification_campaigns(id) on delete set null;

comment on column public.notifications.campaign_id is
  'Campanha que gerou esta notificação. NULL quando a notificação não veio de campanha (fórum, certificado, feed). ON DELETE SET NULL: excluir a campanha no painel não pode apagar a notificação que a aluna já recebeu.';

-- Índice parcial: a esmagadora maioria das linhas é NULL (hoje 5.470
-- notificações no total, 1.335 de campanha). Só precisa cobrir quem veio de
-- campanha — é por aí que o "Destravar" conta.
create index if not exists notifications_campaign_id_idx
  on public.notifications (campaign_id)
  where campaign_id is not null;

-- ── 2. A honestidade da contagem no painel ──────────────────────────────────
alter table public.notification_campaigns
  add column if not exists sent_count_aproximado boolean not null default false;

comment on column public.notification_campaigns.sent_count_aproximado is
  'true quando sent_count veio da contagem por título+tipo+janela de tempo, e não por campaign_id. Só acontece ao destravar campanha cujas notificações são anteriores a esta coluna. O painel mostra o aviso: número aproximado que se passa por exato é o mesmo mal do "1.000 enviadas" de 05/09/2026.';

-- ── 3. Backfill do campaign_id — medido antes de decidir ────────────────────
--
-- A pendência dizia que o backfill era opcional, porque hoje há 3 campanhas e
-- nenhuma em 'sending'. Medi antes de decidir, e ele vale a pena:
--
--   select count(*) from public.notifications where type='admin_broadcast';
--     -> 1335
--   por título: 1000 ("Ferramentas novas na Handify 🧰")
--              + 283 ("Comunidade para você interagir (disponível)")
--              +  52 ("Novo curso disponível!")  = 1335, soma exata
--   os 3 títulos em notification_campaigns são distintos entre si
--
-- Ou seja: todo admin_broadcast do banco pertence a uma das 3 campanhas e o
-- casamento por título não tem empate. Preenchendo agora, o caminho de fallback
-- por título do "Destravar" nasce sem nenhum caso real para atender — que é
-- exatamente onde a gente quer que ele fique.
--
-- As duas guardas do UPDATE:
--   · título com uma campanha só — empate não pode ser resolvido no chute;
--   · janela em volta de sent_at — título reaproveitado numa campanha futura
--     não rouba a notificação de uma campanha antiga.
-- A notificação entra ANTES de sent_at ser gravado (o UPDATE final vem depois
-- do laço de lotes), por isso a janela abre antes e fecha pouco depois.
update public.notifications n
   set campaign_id = c.id
  from public.notification_campaigns c
 where n.campaign_id is null
   and n.type = 'admin_broadcast'
   and n.title = c.title
   and c.sent_at is not null
   and n.created_at between c.sent_at - interval '6 hours'
                        and c.sent_at + interval '1 hour'
   and (select count(*) from public.notification_campaigns c2 where c2.title = c.title) = 1;

-- CONFERIR DEPOIS de rodar (esperado hoje: 1335 com campanha, 0 sem):
--
--   select count(*) filter (where campaign_id is not null) as com_campanha,
--          count(*) filter (where campaign_id is null)     as sem_campanha
--     from public.notifications
--    where type = 'admin_broadcast';
--
--   select id, title, status, sent_count, target_count,
--          (select count(*) from public.notifications n where n.campaign_id = c.id) as contadas
--     from public.notification_campaigns c
--    order by created_at desc;
--
-- A campanha de 05/09/2026 tem que continuar com sent_count 1000 e contadas
-- 1000. Se "contadas" subir, alguma coisa redisparou — o que esta mudança
-- inteira existe para impedir.

-- SEM reparo de campanha travada: medi e hoje não existe nenhuma em 'sending'.
--
--   select status, count(*) from public.notification_campaigns group by status;
--     -> parcial 1, sent 2
--
-- Se uma aparecer depois, o caminho é o botão "Destravar" do painel — ele
-- conta pelo campaign_id, grava o sent_count verdadeiro e registra em
-- audit_log. Não escrever esse UPDATE aqui é de propósito: um reparo cego por
-- SQL não tem como saber quantas alunas receberam.
