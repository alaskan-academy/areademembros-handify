-- ─── Correções do banco vindas da auditoria de 22/09/2026 ────────────────────
--
-- Seis defeitos da mesma família dos incidentes anteriores. Nenhum estava
-- machucando alguém hoje; todos machucariam no primeiro caso que aparecesse.

-- ── 1. O fórum não conhece o Handify Completo ────────────────────────────────
--
-- is_enrolled() libera por três caminhos: admin, matrícula ativa, OU plano ativo
-- + curso in_plan. is_forum_member() só tinha dois — faltava o plano. A aluna do
-- Completo sem linha em enrollments assistiria à aula e comentaria nela, mas o
-- fórum do mesmo curso não apareceria, sem mensagem de erro nenhuma.
--
-- É a mesma forma do erro que deixou o fórum mudo por dois meses em 2026: duas
-- definições de "tem acesso", e a policy apoiada na mais antiga. Hoje 0 de 75
-- membros do plano estão nessa situação, porque a matrícula é criada junto —
-- materializa no primeiro curso in_plan que entrar sem backfill.
create or replace function public.is_forum_member(p_forum_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_admin()
      or exists (
        select 1 from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.user_id = auth.uid()
          and c.forum_id = p_forum_id
          and (e.expires_at is null or e.expires_at > now())
      )
      -- terceiro caminho, igual ao de is_enrolled()
      or (
        public.has_active_membership(auth.uid())
        and exists (
          select 1 from public.courses c
          where c.forum_id = p_forum_id and c.in_plan = true
        )
      );
$$;

comment on function public.is_forum_member(uuid) is
  'Acesso ao fórum: admin, matrícula ativa OU Handify Completo num curso in_plan. Os três caminhos de is_enrolled().';

-- ── 2. Qualquer aluna logada lia a tabela inteira de certificados ────────────
--
-- A policy "Verificação exige autenticação" (qual: auth.uid() IS NOT NULL) era
-- permissiva, e policies permissivas somam por OR: toda aluna autenticada
-- listava os 249 certificados com user_id, curso, data e verify_hash. O hash é
-- UUID v4 para não ser enumerável, e a policy entregava a lista pronta.
--
-- A página /verificar passou a ler com service client filtrando pelo hash
-- (mesmo commit), então a verificação continua funcionando sem esta policy.
drop policy if exists "Verificação exige autenticação" on public.certificates;

-- ── 3. Duas policies de banners anulavam a vigência ──────────────────────────
--
-- "Banners visíveis" (active = true) somava por OR com "Banners ativos
-- visíveis" (active + janela de datas) e apagava o filtro de data. Promoção
-- vencida continuaria na tela; campanha apareceria antes da hora.
drop policy if exists "Banners visíveis" on public.banners;

-- ── 4. Apagar o perfil do admin apagaria o audit_log inteiro ─────────────────
--
-- audit_log.admin_id → profiles estava ON DELETE CASCADE, enquanto
-- memberships.granted_by, notification_campaigns.created_by e
-- email_suppressions.created_by são todas SET NULL. Existe UM perfil admin:
-- apagá-lo levaria junto as 1.155 linhas do log — justamente o histórico que
-- resolveu os incidentes de estorno deste mês.
alter table public.audit_log
  drop constraint if exists audit_log_admin_id_fkey;

alter table public.audit_log
  add constraint audit_log_admin_id_fkey
  foreign key (admin_id) references public.profiles(id) on delete set null;

comment on column public.audit_log.admin_id is
  'Quem fez a ação. NULL para ação automática do webhook/cron, e também quando o perfil do admin é apagado — o histórico sobrevive ao autor.';
