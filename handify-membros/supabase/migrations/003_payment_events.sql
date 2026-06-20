-- ============================================================
-- Migration 003 — Tabelas de pagamento e auditoria
-- ============================================================

-- Registro de todos os webhooks recebidos do Payt
CREATE TABLE IF NOT EXISTS payment_events (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  platform     text        NOT NULL DEFAULT 'payt',
  product_code text        NOT NULL,
  event_type   text        NOT NULL,
  buyer_email  text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  processed    boolean     NOT NULL DEFAULT false,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes do painel admin
CREATE INDEX IF NOT EXISTS payment_events_product_code_idx ON payment_events (product_code);
CREATE INDEX IF NOT EXISTS payment_events_buyer_email_idx  ON payment_events (buyer_email);
CREATE INDEX IF NOT EXISTS payment_events_processed_idx    ON payment_events (processed);
CREATE INDEX IF NOT EXISTS payment_events_created_at_idx   ON payment_events (created_at DESC);

-- RLS: somente service role (webhook) e admins leem/escrevem
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_payment_events" ON payment_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── Audit log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  target_type text        NOT NULL,
  target_id   text,
  meta        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_admin_id_idx    ON audit_log (admin_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx      ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_target_type_idx ON audit_log (target_type);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx  ON audit_log (created_at DESC);

-- RLS: somente admins leem; service role escreve via webhook
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log" ON audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
