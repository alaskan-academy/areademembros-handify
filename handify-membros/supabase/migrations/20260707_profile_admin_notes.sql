-- Anotações internas do admin sobre a aluna (nunca exposta a rotas de aluna)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes text;
