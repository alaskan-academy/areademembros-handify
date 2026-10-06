-- O PDF do certificado carimba a carga horaria no momento da emissao, mas
-- /verificar/[hash] e a lista do perfil liam courses.workload_hours AO VIVO.
-- Entao mudar a carga de um curso faz a pagina de verificacao discordar do PDF que
-- a aluna tem na mao: justamente a pagina que existe para um terceiro confirmar que
-- o certificado e verdadeiro. Com 175 certificados de Saponaria no ar, corrigir a
-- carga do curso sem isto transformaria os 175 em "documento que nao confere".
--
-- O certificado e registro historico: guarda o proprio numero.
--
-- O preenchimento usa o valor atual do curso, que e exatamente o que essas paginas
-- mostram hoje. Conferido nos PDFs antes de rodar: o certificado mais antigo
-- (04/07) e o mais novo (06/10) de Saponaria imprimem os dois "Carga horaria: 4
-- horas", igual ao cadastro. Ou seja, o preenchimento reproduz o que esta impresso,
-- nao inventa. Dai para a frente nenhum certificado emitido muda mais.
alter table public.certificates
  add column if not exists workload_hours numeric;

update public.certificates ce
set workload_hours = c.workload_hours
from public.courses c
where c.id = ce.course_id
  and ce.workload_hours is null;

comment on column public.certificates.workload_hours is
  'Carga horaria impressa NESTE certificado, congelada na emissao. Nao ler de courses: o curso muda, o documento ja emitido nao.';
