-- Copia de seguranca antes de mexer nas aulas agregadoras de material.
-- Sem RLS na tabela de backup seria um vazamento; ela nasce fechada.
create table if not exists public.lesson_materials_backup_20261006 (
  id uuid,
  lesson_id uuid,
  name text,
  file_path text,
  copiado_em timestamptz not null default now()
);

alter table public.lesson_materials_backup_20261006 enable row level security;
revoke all on public.lesson_materials_backup_20261006 from public, anon, authenticated;

insert into public.lesson_materials_backup_20261006 (id, lesson_id, name, file_path)
select lm.id, lm.lesson_id, lm.name, lm.file_path
from public.lesson_materials lm
join public.lessons l on l.id = lm.lesson_id
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.title in (
  'Curso Fábrica das Velas de Lembrancinha',
  'Workshop Buquê de Velas',
  'Curso Saponaria Brasil'
);
