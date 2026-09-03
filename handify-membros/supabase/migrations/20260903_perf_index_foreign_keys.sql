-- 30 chaves estrangeiras não tinham índice: toda consulta pelo "pai" varria a
-- tabela inteira. As duas primeiras estão no caminho de TODA abertura de aula.
--
-- Sem CONCURRENTLY de propósito: as tabelas são pequenas (a maior tem 9 mil
-- linhas) e o bloqueio dura milissegundos. Em tabela grande, use CONCURRENTLY
-- e rode fora de transação.
create index if not exists idx_lesson_content_blocks_lesson_id on public.lesson_content_blocks (lesson_id);
create index if not exists idx_lesson_materials_lesson_id      on public.lesson_materials (lesson_id);

create index if not exists idx_forum_posts_forum_id      on public.forum_posts (forum_id);
create index if not exists idx_forum_posts_user_id       on public.forum_posts (user_id);
create index if not exists idx_forum_comments_user_id    on public.forum_comments (user_id);
create index if not exists idx_forum_comments_parent_id  on public.forum_comments (parent_id);

create index if not exists idx_certificates_course_id      on public.certificates (course_id);
create index if not exists idx_activation_tokens_course_id on public.activation_tokens (course_id);

create index if not exists idx_inspiration_comments_user_id   on public.inspiration_comments (user_id);
create index if not exists idx_inspiration_comments_parent_id on public.inspiration_comments (parent_id);
create index if not exists idx_inspiration_likes_user_id      on public.inspiration_likes (user_id);
create index if not exists idx_inspiration_posts_author_id    on public.inspiration_posts (author_id);
create index if not exists idx_post_likes_user_id             on public.post_likes (user_id);
create index if not exists idx_news_comments_user_id          on public.news_comments (user_id);
create index if not exists idx_news_posts_author_id           on public.news_posts (author_id);
create index if not exists idx_lesson_comments_user_id        on public.lesson_comments (user_id);
create index if not exists idx_reports_reporter_id            on public.reports (reporter_id);
create index if not exists idx_audit_log_admin_id             on public.audit_log (admin_id);
create index if not exists idx_menu_items_parent_id           on public.menu_items (parent_id);
create index if not exists idx_courses_niche_id               on public.courses (niche_id);
create index if not exists idx_courses_forum_id               on public.courses (forum_id);

-- Tabelas ainda pequenas, mas o índice não custa nada agora.
create index if not exists idx_supplier_favorites_supplier_id     on public.supplier_favorites (supplier_id);
create index if not exists idx_wick_recommendations_lesson_id     on public.wick_recommendations (course_lesson_id);
create index if not exists idx_inspiration_posts_featured_student on public.inspiration_posts (featured_student_id);
create index if not exists idx_supplier_suggestions_user_id       on public.supplier_suggestions (user_id);
create index if not exists idx_notification_campaigns_created_by  on public.notification_campaigns (created_by);
create index if not exists idx_saved_wick_formulas_user_id        on public.saved_wick_formulas (user_id);
create index if not exists idx_product_favorites_product_id       on public.product_favorites (product_id);
create index if not exists idx_product_reviews_user_id            on public.product_reviews (user_id);
create index if not exists idx_supplier_reviews_user_id           on public.supplier_reviews (user_id);
