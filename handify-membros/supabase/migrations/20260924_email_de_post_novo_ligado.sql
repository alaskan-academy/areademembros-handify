-- ─── Ligar o e-mail de post novo, sem disparar para o que já existe ────────
--
-- A Jessica pediu: "ligue mas não dispare, dispare apenas para os novos posts
-- que vierem".
--
-- Por que uma coluna nova em vez de reaproveitar `notified_at`: aquele carimbo
-- é posto pelo gatilho BEFORE do banco no momento do INSERT, então um post
-- criado já publicado — que é como o formulário cria — nasce com
-- `notified_at` preenchido. Usá-lo como trava do e-mail faria o e-mail nunca
-- sair para post novo nenhum. São duas perguntas diferentes:
--
--   notified_at → o sino já tocou para este post?
--   emailed_at  → o e-mail já saiu para este post?
--
-- O backfill carimba TODOS os posts que existem hoje (os 2 publicados e o
-- rascunho de 03/07). É isso que cumpre o "não dispare": nenhum post anterior a
-- esta migration consegue mandar e-mail, nem publicado agora, nem republicado
-- daqui a seis meses. Só post criado de hoje em diante nasce com `emailed_at`
-- nulo e manda, uma vez.
--
-- Medido antes: `email_campaign_sends` tem 0 linhas com campaign 'feed-post-%',
-- ou seja, este e-mail nunca saiu para ninguém na vida da plataforma. Se o
-- backfill falhasse, o primeiro clique em publicar mandaria para as ~4.550
-- alunas opt-in de uma vez.

alter table public.news_posts
  add column if not exists emailed_at timestamptz;

comment on column public.news_posts.emailed_at is
  'Quando o e-mail de "post novo" saiu para a base. Preenchido = ja enviado, nao envia de novo (nem ao republicar). Diferente de notified_at, que e o sino e e carimbado pelo gatilho no insert. Limpar a mao (set null) e a forma deliberada de reenviar.';

-- O "não dispare" mora aqui: tudo que existe hoje nasce como já enviado.
update public.news_posts
   set emailed_at = coalesce(created_at, now())
 where emailed_at is null;

-- CONFERIR depois de aplicar:
--   select count(*) from public.news_posts where emailed_at is null;  -- tem que dar 0
-- Depois disso o valor certo passa a ser o número de posts novos ainda não
-- enviados, então não use esta consulta como alarme permanente.
