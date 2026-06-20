-- Extensões necessárias
create extension if not exists "pgcrypto";   -- criptografia de CPF
create extension if not exists "pg_trgm";    -- busca full-text em português
create extension if not exists "uuid-ossp";  -- geração de UUIDs
