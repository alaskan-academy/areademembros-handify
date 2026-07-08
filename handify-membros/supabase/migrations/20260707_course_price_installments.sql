-- Adiciona campo opcional de parcelamento nos cursos
-- Quando null ou 0: produto não exibe parcelas
-- Quando preenchido: parcelas = price / price_installments

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price_installments integer;
