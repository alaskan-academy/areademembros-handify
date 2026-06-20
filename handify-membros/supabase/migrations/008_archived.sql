-- Arquivamento de módulos e aulas (oculta do aluno, visível no admin)
alter table public.modules add column if not exists archived boolean not null default false;
alter table public.lessons add column if not exists archived boolean not null default false;
