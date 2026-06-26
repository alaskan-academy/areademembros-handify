-- ============================================================
-- 028 — Dados de leads e correção do audit_log
-- ============================================================

-- 1. audit_log.admin_id nullable
--    Ações automatizadas (webhook) não têm admin — precisam inserir com admin_id = null
ALTER TABLE public.audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

-- 2. audit_log.action: converter de enum para text
--    O enum original (ban_user, unban_user...) não batia com os valores usados no código
--    (ban, unban, update_email, enrollment.revoked, reject_forum_post, delete_forum_post).
--    Converter para text permite qualquer string, preservando valores já salvos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'audit_log'
      AND column_name  = 'action'
      AND data_type    = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.audit_log
      ALTER COLUMN action TYPE text USING action::text;
  END IF;
END $$;

-- 3. payment_events: coluna buyer_name para facilitar busca de leads sem query JSON
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS buyer_name text;

-- 4. activation_tokens: salvar nome e telefone do comprador para pré-preencher o cadastro
ALTER TABLE public.activation_tokens
  ADD COLUMN IF NOT EXISTS buyer_name  text,
  ADD COLUMN IF NOT EXISTS buyer_phone text;
