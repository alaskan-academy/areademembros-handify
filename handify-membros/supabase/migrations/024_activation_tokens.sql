-- Tokens de ativação de conta (pós-compra Payt)
CREATE TABLE IF NOT EXISTS public.activation_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  token      uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  course_id  uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  used       boolean DEFAULT false,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activation_tokens ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso apenas via service role (webhook e server actions)

-- Data de nascimento no perfil (para promoções segmentadas)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;
