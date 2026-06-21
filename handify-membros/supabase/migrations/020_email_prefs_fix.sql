-- Corrige as chaves de email_prefs para bater com o tipo do app
-- App usa: { certificate, reengagement, news_post }
-- Banco usava: { certificate_ready, new_lesson, news_post, comment_reply, course_complete }

-- 1. Atualiza o DEFAULT da coluna com as chaves corretas (todos true)
ALTER TABLE public.profiles
  ALTER COLUMN email_prefs
  SET DEFAULT '{"certificate": true, "reengagement": true, "news_post": true}'::jsonb;

-- 2. Corrige perfis existentes:
--    - Se já tem a chave correta, mantém o valor que a aluna escolheu
--    - Se tem a chave antiga, migra o valor
--    - Se não tem, adiciona como true (opt-in por padrão)
UPDATE public.profiles
SET email_prefs = jsonb_build_object(
  'certificate',
    COALESCE(
      (email_prefs->>'certificate')::boolean,
      (email_prefs->>'certificate_ready')::boolean,
      true
    ),
  'reengagement',
    COALESCE(
      (email_prefs->>'reengagement')::boolean,
      true
    ),
  'news_post',
    COALESCE(
      (email_prefs->>'news_post')::boolean,
      true
    )
);
