-- Migra courses.product_code (text) para product_codes (text[])
-- Permite vincular múltiplos produtos Payt ao mesmo curso

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS product_codes text[] NOT NULL DEFAULT '{}';

-- Migra dados existentes: código antigo vira item do array
UPDATE courses
  SET product_codes = ARRAY[product_code]
  WHERE product_code IS NOT NULL AND product_code <> '';

-- Remove coluna antiga
ALTER TABLE courses DROP COLUMN IF EXISTS product_code;
