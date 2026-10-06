-- A aula "Referencias e Inspiracoes" carrega o bloco "Parabens! Voce concluiu o
-- curso", mas nao era a ultima aula. Ficava na 17a de 19 em Lembrancinhas, na 8a
-- de 9 no Workshop e na 29a de 30 em Saponaria.
--
-- O certificado so sai com 95% das aulas concluidas, entao a aluna era
-- parabenizada antes de ter direito a ele. Medido antes de mexer, entre quem
-- marcou essa aula como concluida e nao tinha certificado:
--   Lembrancinhas  48 de  75  (64%)
--   Workshop      119 de 205  (58%)
--   Saponaria      61 de 236  (26%)
-- 228 alunas no total.
--
-- Efeito colateral bom: "Materiais das Aulas", que e onde estao as apostilas para
-- imprimir, vinha DEPOIS do "Parabens" e muita gente parava antes. Em
-- Lembrancinhas 75 concluiram a aula do Parabens e so 33 chegaram na de
-- materiais. Passando o Parabens para o fim, a aula das apostilas aparece no
-- caminho de quem ainda esta seguindo o curso.
--
-- `lessons.position` nao tem unicidade por modulo, entao a troca cabe num
-- UPDATE so, sem passo intermediario visivel. lesson_progress e certificates
-- apontam para lesson_id, nunca para a posicao: reordenar nao mexe em progresso
-- nem invalida certificado.
update public.lessons l
set position = novo.position
from (values
  -- Lembrancinhas, modulo "Proximos Passos" 4a2003db
  ('00fc9a79-6ffd-45d5-8338-b763708a97db'::uuid, 3),  -- Referencias e Inspiracoes  1 -> 3
  ('a59f328b-b76a-41b4-b647-5fdc55bab64a'::uuid, 1),  -- Receitas e Precificacao    2 -> 1
  ('74e14781-5963-43f0-b607-7efc66705534'::uuid, 2),  -- Materiais das Aulas        3 -> 2
  -- Saponaria, modulo 2dc0e50b
  ('6d88b5ec-c02f-4a5b-929e-2e752cf5dd20'::uuid, 2),  -- Referencias e Inspiracoes  1 -> 2
  ('ccb714b1-1387-4e94-8a9b-61cf614003db'::uuid, 1),  -- Materiais das Aulas        2 -> 1
  -- Workshop, modulo 7ce350d4
  ('b515d303-2394-4192-92a1-1b637e5801a6'::uuid, 2),  -- Referencias e Inspiracoes  1 -> 2
  ('e7f05bc6-fc61-436e-88ed-c9e929aa290e'::uuid, 1)   -- Materiais para Imprimir    2 -> 1
) as novo(id, position)
where l.id = novo.id;
