-- Migration 004 — access_days em courses
-- null = vitalício | 365 = anual | 30 = mensal
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS access_days integer DEFAULT NULL;

-- Índice para filtragem de matrículas expiradas
CREATE INDEX IF NOT EXISTS enrollments_expires_at_idx
  ON enrollments (expires_at)
  WHERE expires_at IS NOT NULL;
