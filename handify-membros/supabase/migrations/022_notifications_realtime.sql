-- Habilita Realtime na tabela notifications para o sino funcionar ao vivo
-- REPLICA IDENTITY FULL: inclui todos os campos no payload do evento
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Adiciona à publicação realtime do Supabase (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
