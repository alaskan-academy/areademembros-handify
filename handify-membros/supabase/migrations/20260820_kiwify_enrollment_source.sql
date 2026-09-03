-- Kiwify passa a ser uma origem de matrícula válida, ao lado da Payt.
-- Sem este valor no enum, o webhook da Kiwify falha ao gravar a matrícula.
ALTER TYPE enrollment_source ADD VALUE IF NOT EXISTS 'kiwify';
