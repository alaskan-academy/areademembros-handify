-- Lista de alunas do admin com a situacao de cada uma ja calculada.
--
-- A Jessica quer ver tres grupos separados: quem comprou e ativou (conta +
-- curso), quem comprou e nao ativou (token pendente, sem conta) e quem so se
-- cadastrou e nao comprou nada (conta, zero cursos). O terceiro grupo nao
-- existia na tela — aparecia misturado em "Cadastradas".
--
-- PostgREST nao filtra por "existe matricula", entao a view entrega
-- `tem_curso`, `qtd_cursos` e `tem_completo` como colunas — da para paginar,
-- contar e filtrar no banco, sem carregar listas de ids para o servidor.
--
-- security_invoker: quem consulta responde pelas policies de `profiles`.
create or replace view public.admin_alunas_view
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.date_of_birth,
  p.role,
  p.banned,
  p.created_at,
  p.cpf_hash,
  coalesce(c.qtd, 0)::int              as qtd_cursos,
  coalesce(c.qtd, 0) > 0               as tem_curso,
  public.has_active_membership(p.id)   as tem_completo
from public.profiles p
left join (
  select user_id, count(*) as qtd
  from public.enrollments
  where expires_at is null or expires_at > now()
  group by user_id
) c on c.user_id = p.id;

comment on view public.admin_alunas_view is
  'Alunas com situacao calculada para o admin: qtd_cursos/tem_curso (matriculas ativas) e tem_completo (membership ativa). Sem conta nao entra aqui — "sem ativacao" vem de activation_tokens.';

revoke all on public.admin_alunas_view from public, anon;
grant select on public.admin_alunas_view to authenticated, service_role;
