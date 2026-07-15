-- Tabela para migração de alunas da plataforma antiga (Membrify/Payt) para a nova área de membros.
-- Populada pelo script scripts/import-payt-candidates.ts antes de iniciar a campanha de e-mail.

CREATE TABLE IF NOT EXISTS migration_candidates (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text NOT NULL,
  full_name       text,
  cpf_raw         text,        -- CPF em texto simples; apagado após ativação
  phone           text,
  product_codes   text[],      -- product codes comprados na Payt (array)
  token           text,        -- token de 6 chars gerado no Passo 1; expira em 30min
  token_expires   timestamptz,
  activated_at    timestamptz, -- null = não ativou ainda
  created_at      timestamptz DEFAULT now()
);

-- e-mail único (uma candidata por e-mail)
CREATE UNIQUE INDEX migration_candidates_email_idx
  ON migration_candidates (lower(email));

-- lookup rápido por token no Passo 2
CREATE INDEX migration_candidates_token_idx
  ON migration_candidates (token)
  WHERE token IS NOT NULL;

-- RLS: nenhuma aluna acessa esta tabela diretamente; apenas service role
ALTER TABLE migration_candidates ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy pública — só service role (bypassa RLS) pode ler/escrever
