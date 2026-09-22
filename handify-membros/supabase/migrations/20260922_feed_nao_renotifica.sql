-- Despublicar e republicar um aviso renotificava as 4.553 alunas de novo,
-- quantas vezes a admin clicasse. A guarda só olhava a transição false->true,
-- que se repete a cada republish, e não havia nenhuma coluna onde a marca de
-- "já anunciado" pudesse sobreviver. Agora a marca fica na própria linha e não
-- volta atrás quando o post é despublicado.
--
-- Medida antes de escrever: 3 posts, 2 publicados, 3.688 linhas em
-- notifications type='news_post' — uma por aluna por post, nenhuma duplicada.
-- O defeito estava armado, não disparado. Isto desarma.

alter table public.news_posts
  add column if not exists notified_at timestamptz;

comment on column public.news_posts.notified_at is
  'Quando este aviso foi anunciado às alunas. Carimbado uma única vez; NÃO é limpo ao despublicar, e é isso que impede o republish de renotificar.';

-- Backfill obrigatório: tudo que já está no ar já foi anunciado. Sem isto, o
-- primeiro republish de um dos dois posts antigos (14/07 e 04/09) tocaria o
-- sino de ~4.5 mil alunas sobre um aviso de meses atrás. Não separar deste
-- arquivo: ele tem que rodar antes do create or replace abaixo.
update public.news_posts
   set notified_at = created_at
 where published = true
   and notified_at is null;

create or replace function public.notify_on_news_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published = true and new.notified_at is null then
    -- Carimba SEMPRE que a linha está publicada e ainda sem marca, para que
    -- nenhum caminho (editar, fixar) deixe uma linha publicada sem marca.
    new.notified_at := now();

    -- Mas só toca o sino quando este write é o que publicou de fato. Sem esta
    -- segunda guarda, fixar um post publicado-mas-sem-marca tocaria o sino.
    if tg_op = 'INSERT' or old.published = false then
      insert into public.notifications (user_id, type, title, body, link)
      select p.id,
             'news_post',
             'Nova publicação: ' || new.title,
             left(new.body, 100),
             '/comunidade/feed'
        from public.profiles p
       where p.role = 'student'
         and p.banned = false
         -- Mantido igual ao que roda hoje, de propósito.
         --
         -- A versão anterior deste arquivo derrubava este filtro, com o
         -- argumento (bom) de que preferência de E-MAIL não deveria calar o
         -- SINO. Mas isso é mudança de produto, não correção de defeito: são
         -- 4 alunas que pediram para não receber e voltariam a ser
         -- notificadas. Esta migration existe para impedir a renotificação ao
         -- republicar; ampliar o público é outra conversa, e é da Jessica.
         --
         -- Se ela decidir separar as duas preferências, o caminho é uma chave
         -- própria em email_prefs (ex.: 'sino_news_post'), não tirar esta
         -- linha — senão o opt-out de e-mail volta a valer para o sino no
         -- primeiro que reescrever a função.
         and coalesce((p.email_prefs->>'news_post')::boolean, true) = true;
    end if;
  end if;
  return new;
end;
$$;

-- O público do sino NÃO muda: continua `role = 'student'`, não banida, e com
-- o opt-out de news_post respeitado — 4.567 das 4.571 alunas ativas. Esta
-- migration só impede a renotificação ao republicar; quem recebe é a mesma
-- gente de antes.

-- BEFORE, não AFTER: precisa escrever em NEW.notified_at no mesmo write.
drop trigger if exists on_news_post_published on public.news_posts;
create trigger on_news_post_published
  before insert or update on public.news_posts
  for each row execute function public.notify_on_news_post();

revoke execute on function public.notify_on_news_post() from public, anon, authenticated;

-- Como conferir depois de aplicar, sem mandar nada:
--   select count(*) from public.news_posts where published and notified_at is null;  -- tem que dar 0
--   select pg_get_triggerdef(oid) from pg_trigger where tgname='on_news_post_published';  -- tem que dizer BEFORE
