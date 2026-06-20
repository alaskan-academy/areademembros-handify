-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================

-- Busca full-text (pg_trgm)
create index if not exists idx_courses_title_trgm      on public.courses using gin (title gin_trgm_ops);
create index if not exists idx_lessons_title_trgm       on public.lessons using gin (title gin_trgm_ops);
create index if not exists idx_news_posts_title_trgm    on public.news_posts using gin (title gin_trgm_ops);

-- Filtros comuns
create index if not exists idx_courses_category         on public.courses(category_id);
create index if not exists idx_courses_published        on public.courses(published) where published = true;
create index if not exists idx_courses_product_code     on public.courses(product_code);
create index if not exists idx_modules_course           on public.modules(course_id, position);
create index if not exists idx_lessons_module           on public.lessons(module_id, position);

-- Matrícula e progresso
create index if not exists idx_enrollments_user         on public.enrollments(user_id);
create index if not exists idx_enrollments_course       on public.enrollments(course_id);
create index if not exists idx_lesson_progress_user     on public.lesson_progress(user_id);
create index if not exists idx_lesson_progress_lesson   on public.lesson_progress(lesson_id);

-- Comunidade
create index if not exists idx_forum_posts_course       on public.forum_posts(course_id, created_at desc);
create index if not exists idx_forum_comments_post      on public.forum_comments(post_id, created_at);
create index if not exists idx_news_posts_created       on public.news_posts(created_at desc) where published = true;
create index if not exists idx_news_comments_post       on public.news_comments(post_id, created_at);
create index if not exists idx_lesson_comments_lesson   on public.lesson_comments(lesson_id, created_at);
create index if not exists idx_post_likes_target        on public.post_likes(target_type, target_id);

-- Notificações
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read) where read = false;
create index if not exists idx_notifications_user_date   on public.notifications(user_id, created_at desc);

-- Webhooks
create index if not exists idx_payment_events_pending   on public.payment_events(buyer_email) where processed = false;
create index if not exists idx_payment_events_created   on public.payment_events(created_at desc);

-- Banners
create index if not exists idx_banners_active           on public.banners(active, position_slot) where active = true;

-- Moderação
create index if not exists idx_reports_unresolved       on public.reports(resolved) where resolved = false;
