-- Coluna para busca determinística de CPF (SHA-256 do CPF em dígitos)
-- Não expõe o CPF — apenas permite igualdade na busca do admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_hash text;

CREATE INDEX IF NOT EXISTS profiles_cpf_hash_idx ON public.profiles (cpf_hash);
