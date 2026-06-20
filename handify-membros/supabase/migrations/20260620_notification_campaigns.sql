-- Campanhas de notificação (criadas pelo admin)
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,                          -- título interno (label do admin)
  body         text        NOT NULL,                          -- corpo da notificação
  link         text,                                          -- URL opcional ao clicar
  target       text        NOT NULL DEFAULT 'all',            -- 'all' | 'course:{uuid}'
  scheduled_at timestamptz,                                   -- null = enviar imediatamente
  sent_at      timestamptz,
  sent_count   integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','scheduled','sending','sent','cancelled')),
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_campaigns ENABLE ROW LEVEL SECURITY;

-- Somente admins gerenciam campanhas
CREATE POLICY "admins_manage_campaigns"
  ON notification_campaigns FOR ALL
  TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Índice para o cron buscar campanhas pendentes
CREATE INDEX IF NOT EXISTS notification_campaigns_status_scheduled
  ON notification_campaigns (status, scheduled_at)
  WHERE status = 'scheduled';

-- Habilitar Realtime na tabela de notificações (para o sino atualizar em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
