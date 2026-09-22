-- ─── D24/D05: anunciar curso novo é uma coisa que acontece UMA vez ──────────
--
-- `togglePublished` chamava `notifyNewCourse` toda vez que `published` virava
-- true. Despublicar e republicar — dois cliques no mesmo botão da lista de
-- cursos — reenviava o e-mail "Novo curso na Handify" para as 4.555 alunas
-- opt-in, do zero. Não havia coluna, tabela nem log dizendo que aquele curso já
-- tinha sido anunciado: nada impedia o segundo disparo e nada registrava o
-- primeiro.
--
-- `announced_at` é a marca, e o update condicional em `announceCourse`
-- (`.is("announced_at", null)`) usa a própria marcação como cadeado: quem
-- perde a corrida recebe zero linhas e sai sem mandar nada.

alter table public.courses
  add column if not exists announced_at timestamptz;

comment on column public.courses.announced_at is
  'Quando o e-mail de "curso novo" saiu para a base. Preenchido = já anunciado, não anuncia de novo. Limpar à mão (set null) é a forma deliberada de reanunciar.';

-- Backfill: os 24 cursos de hoje já estão publicados há semanas e a base já os
-- conhece. Marcar todos garante que nenhum curso existente dispare e-mail
-- depois do deploy — nem pelo botão, nem pelo formulário de edição, que a
-- partir de agora também chama o anúncio. Só curso criado daqui em diante
-- nasce com `announced_at` nulo e anuncia, uma vez.
update public.courses
   set announced_at = coalesce(created_at, now())
 where announced_at is null;

-- ORDEM — o aviso que estava aqui antes estava INVERTIDO, e duas revisões
-- independentes derrubaram cada uma por sua conta. Deixo o que foi medido:
--
-- * Código antes da migration: `announceCourse` faz `.update({ announced_at })`
--   num campo que o PostgREST não tem no schema cache, volta PGRST204, a
--   função dá throw e o catch engole. **Zero e-mail.** Falha para o lado
--   seguro; o que se perde é um anúncio legítimo, com um console.error.
--
-- * Migration antes do código: o código velho (`togglePublished`, com
--   `void notifyNewCourse`) publica curso, MANDA o e-mail e deixa
--   `announced_at` nulo, porque ele não conhece a coluna. Quando o código novo
--   subir, o primeiro save desse curso reivindica o nulo e **manda tudo de
--   novo** para as ~4.568 — e não há trava segurando, porque
--   `email_campaign_sends` não tem uma linha sequer de `novo-curso-%`.
--
-- As duas ordens têm janela, mas de sinais opostos: uma perde um anúncio, a
-- outra manda e-mail repetido. Como a ordem de hoje é silêncio, a segura é
-- código primeiro.
--
-- Na prática: aplicar a migration e subir o código na MESMA janela, e não
-- publicar nem republicar curso nenhum no meio. Conferir que
-- `count(*) where announced_at is null` está em 0 no minuto anterior ao deploy
-- entrar no ar.
--
-- CONFERIR: select count(*) from public.courses where announced_at is null;
--   0 logo depois de aplicar. Depois disso o valor certo passa a ser o número
--   de cursos novos esperando anúncio — não use esta consulta como alarme
--   permanente.
