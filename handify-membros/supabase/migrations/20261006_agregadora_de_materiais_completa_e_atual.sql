-- A aula "Materiais das Aulas" / "Materiais para Imprimir" existe para a aluna
-- baixar tudo de uma vez. Hoje ela nao cumpre isso:
--   * em Saponaria, 12 linhas apontam para o rascunho de julho (144 KB) em vez
--     da apostila final de agosto (1,8 MB). Quem baixa de la leva o arquivo errado.
--   * em Lembrancinhas falta a apostila da aula de mensagem secreta.
--   * no Workshop falta a apostila de Boas Vindas.
--   * os nomes sao "aula7_lsa_moment.pdf", que nao dizem nada para quem imprime.
-- Esta migration torna a agregadora igual a soma do curso, sempre na versao mais
-- nova de cada aula, com nome que a aluna entende.
--
-- Os `id` existentes sao PRESERVADOS: lesson_content_blocks do tipo `download`
-- guardam `material_id`. Apagar e recriar deixaria esse bloco apontando para o
-- vazio, entao aqui e UPDATE no lugar, e DELETE so do que sobra.
-- Copia do estado anterior em public.lesson_materials_backup_20261006.

create temporary table desejado on commit drop as
with alvo(curso, agregadora) as (values
  ('Curso Fábrica das Velas de Lembrancinha','74e14781-5963-43f0-b607-7efc66705534'::uuid),
  ('Curso Saponaria Brasil','ccb714b1-1387-4e94-8a9b-61cf614003db'::uuid),
  ('Workshop Buquê de Velas','e7f05bc6-fc61-436e-88ed-c9e929aa290e'::uuid)
),
arquivos as (
  select a.agregadora,
         split_part(lm.file_path,'/',1)::uuid as pasta,
         lm.file_path,
         (regexp_replace(split_part(lm.file_path,'/',2),'\D','','g'))::bigint as carimbo
  from alvo a
  join courses c on c.title = a.curso
  join modules m on m.course_id = c.id
  join lessons l on l.module_id = m.id
  join lesson_materials lm on lm.lesson_id = l.id
),
-- Uma pasta por aula; dentro dela vale o carimbo mais alto, que e o upload mais
-- recente. Foi assim que as apostilas finais de agosto foram publicadas.
mais_novo as (
  select distinct on (agregadora, pasta) agregadora, pasta, file_path
  from arquivos order by agregadora, pasta, carimbo desc
)
select mn.agregadora, mn.pasta, mn.file_path,
       lpad((row_number() over (partition by mn.agregadora order by mo.position, lo.position))::text, 2, '0')
         || ' - ' || regexp_replace(trim(lo.title), '[\\/:*?"<>|]', '-', 'g') || '.pdf' as nome
from mais_novo mn
join lessons lo on lo.id = mn.pasta
join modules mo on mo.id = lo.module_id;

-- Entre linhas repetidas da mesma pasta, fica a que algum bloco de download
-- referencia; na falta disso, a de menor id. O criterio precisa ser estavel,
-- senao duas execucoes guardam linhas diferentes.
create temporary table manter on commit drop as
select distinct on (lm.lesson_id, split_part(lm.file_path,'/',1)) lm.id
from lesson_materials lm
join desejado d on d.agregadora = lm.lesson_id
                and d.pasta::text = split_part(lm.file_path,'/',1)
order by lm.lesson_id, split_part(lm.file_path,'/',1),
         (exists (select 1 from lesson_content_blocks b
                  where b.type = 'download'
                    and b.content::jsonb->>'material_id' = lm.id::text)) desc,
         lm.id;

update lesson_materials lm
set file_path = d.file_path, name = d.nome
from desejado d
where lm.id in (select id from manter)
  and d.agregadora = lm.lesson_id
  and d.pasta::text = split_part(lm.file_path,'/',1);

delete from lesson_materials lm
where lm.lesson_id in (select distinct agregadora from desejado)
  and lm.id not in (select id from manter);

insert into lesson_materials (lesson_id, name, file_path)
select d.agregadora, d.nome, d.file_path
from desejado d
where not exists (
  select 1 from lesson_materials lm
  where lm.lesson_id = d.agregadora and lm.file_path = d.file_path
);
