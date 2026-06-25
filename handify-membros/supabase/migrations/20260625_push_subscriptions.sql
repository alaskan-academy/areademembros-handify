-- Tabela de subscriptions Web Push por usuário
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- RLS: cada aluna só acessa as próprias subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_own" ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin pode ler todas (para broadcast)
CREATE POLICY "push_subs_admin_read" ON public.push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Índice para broadcast eficiente
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions (user_id);
