-- ─── Reengajamento: semanal, 4 ciclos, sem atropelar as campanhas ────────────
--
-- O cron de reengajamento tinha três defeitos que se cancelavam:
--
-- 1. Nenhuma trava de repetição. Não registrava o que enviava, então a aluna
--    que ficasse 30 dias sem entrar receberia o MESMO e-mail 30 vezes.
-- 2. A busca de matrículas não tinha `.limit()`, e o PostgREST corta em 1.000 —
--    via 1.000 das 10.005 matrículas, sempre as mesmas.
-- 3. Quatro consultas por matrícula dentro do laço. Com o corte acima, 4.000
--    consultas em sequência, sem `maxDuration` — a função estourava o tempo
--    antes de mandar qualquer coisa.
--
-- Na prática o item 3 escondia o item 1. Consertar só o desempenho teria
-- transformado um cron quebrado em spam diário para ~2.500 alunas.
--
-- Esta função faz numa consulta o que o laço fazia em milhares, e devolve só
-- quem está elegível de verdade. As regras de prioridade ficam aqui porque
-- dependem de dados, não de código:
--
--   Convite Completo (conclusão)  >  Campanha Completo (base)  >  Reengajamento
--
-- O reengajamento é o único que se abstém. Os outros dois mandam sempre.
create or replace function public.alunas_para_reengajar(
  dias_inatividade int default 7,
  max_ciclos       int default 4,
  dias_entre_ciclos int default 7
)
returns table (
  user_id     uuid,
  email       text,
  full_name   text,
  proximo_ciclo int,
  cursos      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with aulas_do_curso as (
    -- Só aula viva conta: aula ou módulo arquivado não deve puxar o progresso
    -- para baixo e fazer um curso concluído parecer incompleto.
    select m.course_id, l.id as lesson_id
    from public.modules m
    join public.lessons l on l.module_id = m.id
    where m.archived = false and l.archived = false
  ),
  matricula as (
    select e.user_id, e.course_id
    from public.enrollments e
    where e.expires_at is null or e.expires_at > now()
  ),
  progresso as (
    select mt.user_id, mt.course_id,
           count(ac.lesson_id) as total_aulas,
           count(lp.lesson_id) as aulas_tocadas,
           count(lp.lesson_id) filter (where lp.completed) as aulas_concluidas,
           max(lp.updated_at) as ultimo_acesso
    from matricula mt
    join aulas_do_curso ac on ac.course_id = mt.course_id
    left join public.lesson_progress lp
      on lp.lesson_id = ac.lesson_id and lp.user_id = mt.user_id
    group by mt.user_id, mt.course_id
  ),
  elegivel as (
    select p.user_id, p.course_id,
           round((p.aulas_concluidas::numeric / nullif(p.total_aulas,0)) * 100, 0) as pct
    from progresso p
    where p.total_aulas > 0
      -- quem nunca abriu o curso não entra: é outra conversa, não "volta lá"
      and p.aulas_tocadas > 0
      and p.aulas_concluidas < p.total_aulas
      and p.ultimo_acesso < now() - make_interval(days => dias_inatividade)
  ),
  -- Quantos ciclos a aluna já recebeu, e quando foi o último
  ciclos as (
    select s.user_id,
           count(*) as recebidos,
           max(s.sent_at) as ultimo_envio
    from public.email_campaign_sends s
    where s.campaign like 'reengajamento-%'
    group by s.user_id
  )
  select pr.id, pr.email, pr.full_name,
         (coalesce(c.recebidos, 0) + 1)::int as proximo_ciclo,
         jsonb_agg(jsonb_build_object('title', co.title, 'slug', co.slug, 'progressPercent', el.pct)
                   order by el.pct desc, co.title) as cursos
  from elegivel el
  join public.profiles pr on pr.id = el.user_id
  join public.courses co on co.id = el.course_id
  left join ciclos c on c.user_id = el.user_id
  where pr.email is not null
    and pr.banned = false
    and pr.role <> 'admin'
    -- opt-out da aluna
    and coalesce((pr.email_prefs->>'reengagement')::boolean, true) is not false
    -- teto de ciclos
    and coalesce(c.recebidos, 0) < max_ciclos
    -- intervalo entre ciclos
    and (c.ultimo_envio is null or c.ultimo_envio < now() - make_interval(days => dias_entre_ciclos))
    -- PRIORIDADE 1: quem está NO MEIO da sequência de conclusão do Completo não
    -- recebe. São 3 e-mails ao longo de 90 dias; enquanto durar, o Completo
    -- manda e o reengajamento cala. Quem já recebeu as 3 etapas está liberado,
    -- e quem nunca entrou na sequência também.
    --
    -- O `group by` não é decorativo: sem ele, `having count(*) < 3` devolve uma
    -- linha mesmo quando não há registro nenhum (count = 0), e o `not exists`
    -- passa a excluir TODA aluna. Foi o que aconteceu na primeira versão —
    -- a função devolvia zero e parecia que ninguém estava elegível.
    and not exists (
      select 1 from public.email_campaign_sends s
      where s.user_id = pr.id
        and s.campaign like 'plano-completo-conclusao-%'
      group by s.user_id
      having count(*) between 1 and 2
    )
    -- PRIORIDADE 2: nada de dois e-mails na mesma semana. Cobre o disparo da
    -- base (terças) e qualquer etapa de conclusão que tenha saído há pouco.
    and not exists (
      select 1 from public.email_campaign_sends s
      where s.user_id = pr.id
        and s.campaign like 'plano-completo%'
        and s.sent_at > now() - interval '7 days'
    )
  group by pr.id, pr.email, pr.full_name, c.recebidos;
$$;

comment on function public.alunas_para_reengajar(int, int, int) is
  'Alunas inativas elegíveis ao reengajamento. Já aplica opt-out, teto de ciclos, intervalo e a prioridade das campanhas do Handify Completo.';

revoke all on function public.alunas_para_reengajar(int, int, int) from anon, authenticated;
