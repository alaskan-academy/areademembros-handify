-- Configurar quais cursos concedem certificado (padrão: false)
alter table public.courses
  add column if not exists has_certificate boolean not null default false;
