-- ============================================================
-- TRIGGER: criar profile ao registrar usuário no Auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );

  -- Processar eventos Payt pendentes com este e-mail
  perform public.process_pending_payment_events(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FUNÇÃO: processar webhooks Payt pendentes por e-mail
-- Chamada ao criar perfil, para dar acesso retroativo
-- ============================================================
create or replace function public.process_pending_payment_events(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event     record;
  v_course    record;
  v_user_id   uuid;
begin
  select id into v_user_id from public.profiles where email = p_email;
  if v_user_id is null then return; end if;

  for v_event in
    select * from public.payment_events
    where buyer_email = p_email
      and processed = false
      and error is null
  loop
    -- Buscar curso pelo product_code
    select id into v_course from public.courses where product_code = v_event.product_code;

    if v_course.id is not null then
      insert into public.enrollments (user_id, course_id, source)
      values (v_user_id, v_course.id, 'payt')
      on conflict (user_id, course_id) do nothing;

      update public.payment_events set processed = true where id = v_event.id;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- TRIGGER: notificação ao publicar post no feed de notícias
-- ============================================================
create or replace function public.notify_on_news_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published = true and (old is null or old.published = false) then
    insert into public.notifications (user_id, type, title, body, link)
    select
      p.id,
      'news_post',
      'Nova publicação: ' || new.title,
      left(new.body, 100),
      '/comunidade/feed'
    from public.profiles p
    where p.role = 'student'
      and p.banned = false
      and (p.email_prefs->>'news_post')::boolean = true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_news_post_published on public.news_posts;
create trigger on_news_post_published
  after insert or update on public.news_posts
  for each row execute function public.notify_on_news_post();

-- ============================================================
-- TRIGGER: notificação ao responder comentário
-- ============================================================
create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user uuid;
  v_post_title  text;
begin
  -- Notificar autor do post do fórum quando alguém comenta
  if TG_TABLE_NAME = 'forum_comments' then
    select fp.user_id, fp.title into v_parent_user, v_post_title
    from public.forum_posts fp where fp.id = new.post_id;

    if v_parent_user is not null and v_parent_user <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (
        v_parent_user,
        'comment_reply',
        'Nova resposta no seu post',
        left(new.body, 100),
        '/comunidade/forum'
      );
    end if;
  end if;

  -- Notificar autor do post de notícias
  if TG_TABLE_NAME = 'news_comments' then
    select np.author_id into v_parent_user
    from public.news_posts np where np.id = new.post_id;

    if v_parent_user is not null and v_parent_user <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (
        v_parent_user,
        'comment_reply',
        'Novo comentário no seu post',
        left(new.body, 100),
        '/comunidade/feed'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_forum_comment_created on public.forum_comments;
create trigger on_forum_comment_created
  after insert on public.forum_comments
  for each row execute function public.notify_on_comment_reply();

drop trigger if exists on_news_comment_created on public.news_comments;
create trigger on_news_comment_created
  after insert on public.news_comments
  for each row execute function public.notify_on_comment_reply();

-- ============================================================
-- TRIGGER: notificação ao adicionar nova aula em curso matriculado
-- ============================================================
create or replace function public.notify_on_new_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_course_title text;
begin
  select m.course_id, c.title into v_course_id, v_course_title
  from public.modules m
  join public.courses c on c.id = m.course_id
  where m.id = new.module_id;

  insert into public.notifications (user_id, type, title, body, link)
  select
    e.user_id,
    'new_lesson',
    'Nova aula em ' || v_course_title,
    new.title,
    '/aulas/' || new.id
  from public.enrollments e
  where e.course_id = v_course_id
    and (e.expires_at is null or e.expires_at > now());

  return new;
end;
$$;

drop trigger if exists on_lesson_created on public.lessons;
create trigger on_lesson_created
  after insert on public.lessons
  for each row execute function public.notify_on_new_lesson();
