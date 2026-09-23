-- ─── O fórum respondia para ninguém ─────────────────────────────────────────
--
-- Nada avisava a equipe quando uma aluna postava ou respondia no fórum:
-- `createForumPost` e `addForumComment` não inseriam nada em `notifications`.
-- Medido em 22/09/2026: 18 comentários de aluna sem nenhuma resposta depois.
-- Não era descaso — era que ninguém tinha como saber que existiam.
--
-- Esta migration faz duas coisas:
--
--   PARTE 1: acrescenta 'forum_activity' ao enum `notification_type`, que é o
--            tipo do aviso que vai para a equipe (o insert é do TypeScript, em
--            src/lib/notifications/forum.ts).
--
--   PARTE 2: reescreve `notify_on_comment_reply()`, o gatilho que já existia,
--            para (a) avisar a dona do COMENTÁRIO respondido — hoje ele só
--            avisa a dona do post, e por isso as 246 respostas do fórum nunca
--            avisaram ninguém sobre resposta a comentário — e (b) mandar o
--            link para o post exato em vez de '/comunidade/forum', que é a
--            lista e não ajuda a achar nada.
--
-- POR QUE AS DUAS PARTES ESTÃO SEPARADAS: no Postgres, um valor novo de enum
-- criado por `alter type ... add value` não pode ser USADO na mesma transação
-- que o criou ("unsafe use of new value of enum type"). A PARTE 2 abaixo foi
-- escrita de propósito sem nenhuma menção a 'forum_activity' — ela só mexe em
-- 'comment_reply', que já existe —, então o arquivo roda inteiro de uma vez.
-- Se o seu aplicador reclamar mesmo assim, rode a PARTE 1 sozinha, dê commit,
-- e depois rode a PARTE 2.


-- ── PARTE 1 ────────────────────────────────────────────────────────────────

alter type public.notification_type add value if not exists 'forum_activity';


-- ── PARTE 2 ────────────────────────────────────────────────────────────────

-- Trava: sem o valor no enum, o aviso da equipe é recusado pelo banco com
-- "invalid input value for enum" e some no log. Comparação por texto de
-- propósito — fazer cast para o tipo aqui seria justamente o "uso" que a
-- mesma transação não permite.
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname = 'notification_type'
       and e.enumlabel = 'forum_activity'
  ) then
    raise exception
      'Rode a PARTE 1 desta migration antes: sem forum_activity no enum, o aviso para a equipe é recusado.';
  end if;
end $$;

-- O MESMO gatilho atende forum_comments e news_comments (on_forum_comment_created
-- e on_news_comment_created). O ramo de news_comments continua igual ao que
-- está no ar — mexer nele aqui mudaria o sino do feed sem ninguém pedir.
--
-- Quem recebe aviso de um comentário do fórum, e por quê:
--   - a dona do comentário respondido, quando é resposta (`parent_id`);
--   - a dona do post, porque a conversa é dela — a não ser que já esteja na
--     linha de cima, senão receberia dois sinos do mesmo comentário;
--   - nunca quem escreveu. Aviso de si mesma é ruído.
--
-- A MESMA regra está em `quemRecebeAvisoDeComentario`
-- (src/lib/notifications/forum.ts), que decide para quem sai o Web Push. O
-- banco não tem como falar com o Web Push e o TypeScript não pode inserir o
-- sino aqui sem duplicar — mudou de um lado, muda do outro.
create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_post_user  uuid;
  v_forum_slug text;
  v_pai_user   uuid;
  v_link       text;
begin
  if TG_TABLE_NAME = 'forum_comments' then
    -- left join: forum_id é not null desde 20260922_forum_caminho_legado.sql,
    -- mas um fórum sumido não pode engolir o aviso — sem slug o link cai na
    -- lista, que é pouco, e não em lugar nenhum, que é pior.
    select fp.user_id, f.slug
      into v_post_user, v_forum_slug
      from public.forum_posts fp
      left join public.forums f on f.id = fp.forum_id
     where fp.id = new.post_id;

    v_link := case
                when v_forum_slug is null then '/comunidade/forum'
                else '/comunidade/forum/' || v_forum_slug
                     || '?post=' || new.post_id::text
                     || '&comentario=' || new.id::text
              end;

    if new.parent_id is not null then
      select fc.user_id
        into v_pai_user
        from public.forum_comments fc
       where fc.id = new.parent_id;
    end if;

    if v_pai_user is not null and v_pai_user <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (v_pai_user, 'comment_reply', 'Responderam seu comentário',
              left(new.body, 100), v_link);
    end if;

    if v_post_user is not null
       and v_post_user <> new.user_id
       and v_post_user is distinct from v_pai_user then
      insert into public.notifications (user_id, type, title, body, link)
      values (v_post_user, 'comment_reply', 'Nova resposta no seu post',
              left(new.body, 100), v_link);
    end if;
  end if;

  if TG_TABLE_NAME = 'news_comments' then
    select np.author_id into v_post_user
      from public.news_posts np where np.id = new.post_id;

    if v_post_user is not null and v_post_user <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (v_post_user, 'comment_reply', 'Novo comentário no seu post',
              left(new.body, 100), '/comunidade/feed');
    end if;
  end if;

  return new;
end;
$function$;

-- `create or replace` preserva o ACL, mas repetir o fechamento não custa nada e
-- protege de alguém recriar a função com drop + create. `from public` é o que
-- fecha de verdade: anon e authenticated herdam de PUBLIC, então revogar deles
-- dois sem revogar de PUBLIC não fecha porta nenhuma (foi assim que nove
-- funções de relatório ficaram abertas até 22/09/2026).
revoke all on function public.notify_on_comment_reply() from public;
grant execute on function public.notify_on_comment_reply() to service_role;

-- Como conferir depois de aplicar, sem escrever nada:
--
--   -- 1) o valor entrou no enum
--   select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = 'notification_type' order by e.enumsortorder;
--
--   -- 2) a função está fechada (só postgres e service_role)
--   select proacl::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'notify_on_comment_reply';
--
--   -- 3) os avisos novos apontam para o post exato, não para a lista
--   select type, title, link, created_at from public.notifications
--    where type in ('comment_reply', 'forum_activity')
--    order by created_at desc limit 20;
