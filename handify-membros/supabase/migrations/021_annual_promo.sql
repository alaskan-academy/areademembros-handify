-- Botão de promoção do plano anual — tabela de configuração (single row)
CREATE TABLE IF NOT EXISTS public.annual_promo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active        boolean NOT NULL DEFAULT false,
  link_url      text    NOT NULL DEFAULT '',
  badge_text    text    NOT NULL DEFAULT 'Plano Anual',
  modal_title   text    NOT NULL DEFAULT 'Assine o Plano Anual Handify™',
  modal_desc    text    NOT NULL DEFAULT '',
  button_text   text    NOT NULL DEFAULT 'Assinar agora',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Garante que só exista uma linha
CREATE UNIQUE INDEX IF NOT EXISTS annual_promo_single ON public.annual_promo ((true));

-- Insere a linha inicial (ignorar se já existir)
INSERT INTO public.annual_promo (active, link_url, badge_text, modal_title, modal_desc, button_text)
VALUES (false, '', 'Plano Anual', 'Assine o Plano Anual Handify™', '', 'Assinar agora')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.annual_promo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia annual_promo" ON public.annual_promo;
DROP POLICY IF EXISTS "Aluna lê annual_promo ativo" ON public.annual_promo;

CREATE POLICY "Admin gerencia annual_promo" ON public.annual_promo
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Aluna lê annual_promo ativo" ON public.annual_promo
  FOR SELECT TO authenticated
  USING (active = true);
