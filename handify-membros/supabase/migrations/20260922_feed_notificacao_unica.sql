-- Sino de post novo: uma notificação por aluna, e só uma fonte.
--
-- Este arquivo NÃO redefine `notify_on_news_post()`. A redefinição inteira
-- (incluindo a queda do filtro `email_prefs->>'news_post'`, que era preferência
-- de E-MAIL calando o SINO de 4 alunas) mora em
-- 20260922_feed_nao_renotifica.sql, que roda antes deste por ordem alfabética
-- do nome do arquivo ("feed_nao" < "feed_not").
--
-- Por que o aviso importa: a versão original desta correção recriava o gatilho
-- como AFTER INSERT OR UPDATE. Rodando depois da outra migration, isso
-- desfaria o BEFORE e a coluna `notified_at` deixaria de ser carimbada —
-- republicar um aviso voltaria a notificar as ~4.5 mil alunas de novo. Por isso
-- aqui só sobrou o que é seguro repetir.
--
-- A outra metade do defeito (o TypeScript inserindo em `notifications` junto
-- com o gatilho, o que entregava 2 sinos por aluna) foi fechada no código:
-- src/app/(admin)/admin/comunidade/feed/actions.ts, função notifyNewsPost.
-- O gatilho é o dono único do sino; o TypeScript é o dono único do e-mail.

-- Reafirma o revoke de 20260902_security_close_exposed_functions.sql:45.
-- `create or replace function` não desfaz o revoke, mas repetir não custa nada
-- e protege contra alguém recriar a função com `drop` + `create`.
revoke execute on function public.notify_on_news_post() from public, anon, authenticated;

-- Trava de ordem de aplicação. Se este arquivo rodar antes do outro (ou se o
-- outro não tiver sido aplicado), pára aqui em vez de deixar o banco num estado
-- em que republicar renotifica todo mundo em silêncio.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'news_posts'
       and column_name = 'notified_at'
  ) then
    raise exception
      'Aplique 20260922_feed_nao_renotifica.sql primeiro: sem news_posts.notified_at o republish renotifica as alunas.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'on_news_post_published'
       and (tgtype & 2) = 2  -- bit 2 = BEFORE
  ) then
    raise exception
      'on_news_post_published precisa ser BEFORE para carimbar notified_at no mesmo write. Reaplique 20260922_feed_nao_renotifica.sql.';
  end if;
end $$;

-- Como conferir depois de aplicar, sem mandar nada:
--   select count(*) from public.news_posts where published and notified_at is null;  -- 0
--   select count(*) from public.email_campaign_sends where campaign like 'feed-post-%';  -- 0
--     (continua 0 enquanto ENVIAR_EMAIL_DE_POST_NOVO for false no código)
