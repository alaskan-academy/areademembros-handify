-- ─── As funções de relatório estavam abertas à chave pública ────────────────
--
-- `revoke ... from anon, authenticated` não fecha função nenhuma: os dois
-- papéis herdam EXECUTE do papel PUBLIC, e é PUBLIC que precisa perder. A
-- auditoria de 02/09/2026 já tinha anotado isso; as funções criadas depois
-- nasceram com a convenção errada mesmo assim.
--
-- Não é teoria. Em 22/09/2026, com a chave anônima — a que viaja dentro do
-- JavaScript que todo navegador baixa, e que por definição não é segredo —
-- estas chamadas respondiam HTTP 200 de fora:
--
--   POST /rest/v1/rpc/alunas_para_reengajar  → 900 linhas com user_id, email
--                                               e full_name de alunas reais
--   POST /rest/v1/rpc/compras_sem_acesso     → e-mail, nome e curso de quem
--                                               comprou
--
-- São `security definer`, então rodavam com os privilégios do dono e a RLS não
-- as continha. Qualquer pessoa na internet listava a base.
--
-- Todos os chamadores no código usam service role (conferido um a um:
-- cron/compras-sem-acesso, cron/reengagement, process-purchase e
-- vincular-compra). Nenhum usa o cliente anônimo ou o autenticado, então
-- tirar de PUBLIC e dar explicitamente ao service_role não quebra nada.

revoke all on function public.compras_sem_acesso(integer) from public;
grant execute on function public.compras_sem_acesso(integer) to service_role;

-- Quatro argumentos, não três: assinatura errada não dá erro de "função não
-- encontrada" aqui, ela simplesmente não casa com nada e o revoke falha.
revoke all on function public.alunas_para_reengajar(integer, integer, integer, integer) from public;
grant execute on function public.alunas_para_reengajar(integer, integer, integer, integer) to service_role;

revoke all on function public.acesso_revogado_mas_pago(integer) from public;
grant execute on function public.acesso_revogado_mas_pago(integer) to service_role;

revoke all on function public.codigos_vendidos_sem_curso(integer) from public;
grant execute on function public.codigos_vendidos_sem_curso(integer) to service_role;

revoke all on function public.curso_coberto_por_outra_compra(text, uuid, text) from public;
grant execute on function public.curso_coberto_por_outra_compra(text, uuid, text) to service_role;

revoke all on function public.compra_estornada(text, text) from public;
grant execute on function public.compra_estornada(text, text) to service_role;

-- `telefone_comparavel` e `email_minusculo` ficam como estão de propósito:
-- a primeira é pura (texto entra, texto sai, nenhum dado da base) e a segunda
-- é gatilho, que chamada à mão não faz nada. Fechar as duas mexeria em caminho
-- de escrita sem fechar exposição nenhuma.

-- CONFERIR depois de aplicar — nenhuma das seis pode ter '=X/' no proacl:
--   select proname, proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and proname in ('compras_sem_acesso','alunas_para_reengajar',
--          'acesso_revogado_mas_pago','codigos_vendidos_sem_curso',
--          'curso_coberto_por_outra_compra','compra_estornada');
-- E a chamada de fora com a chave anônima tem que devolver 404 ou 401.
