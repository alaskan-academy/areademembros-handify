-- Adiciona o tipo admin_broadcast ao enum notification_type
-- Necessário para campanhas enviadas pelo admin via /admin/notificacoes
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_broadcast';
