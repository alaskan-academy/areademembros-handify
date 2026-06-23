-- Adiciona chave new_course ao JSONB email_prefs nos perfis existentes
-- Apenas para registros que já têm email_prefs (null = usa default true no app)
UPDATE public.profiles
SET email_prefs = email_prefs || '{"new_course": true}'::jsonb
WHERE email_prefs IS NOT NULL
  AND NOT (email_prefs ? 'new_course');
