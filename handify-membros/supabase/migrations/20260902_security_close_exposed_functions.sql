-- ============================================================================
-- Fecha funções do banco que estavam publicadas na API REST (/rest/v1/rpc).
--
-- CRÍTICO — sobras da migração da plataforma anterior:
--   import_auth_user gravava direto em auth.users com
--   ON CONFLICT (id) DO UPDATE SET encrypted_password, e estava aberta para
--   chamadas anônimas. Qualquer pessoa com a chave pública do site (que vai
--   dentro do JS de todo navegador) podia sobrescrever a senha de qualquer
--   conta, inclusive a de administradora.
--   get_pro_user_ids devolvia a lista completa de ids de usuário — o alvo
--   que faltava para completar o ataque. Verificado: 1.000 ids em uma
--   chamada anônima.
--
-- Nada no aplicativo referencia estas funções: a migração já tinha terminado.
-- ============================================================================
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'import_auth_user',
        'import_auth_identity',
        'get_pro_user_ids',
        'get_pro_identity_ids'
      )
  loop
    execute format('drop function if exists %s', fn.assinatura);
    raise notice 'removida: %', fn.assinatura;
  end loop;
end $$;

-- ============================================================================
-- Funções de gatilho não devem ser chamáveis pela API.
--
-- Atenção: a permissão vem do papel PUBLIC (padrão do Postgres), não de
-- anon/authenticated. Revogar só de anon/authenticated não tem efeito nenhum.
--
-- service_role e postgres têm concessões próprias e não são afetados: webhook,
-- Server Actions e os gatilhos continuam funcionando.
-- ============================================================================
revoke execute on function public.handle_new_user()                     from public, anon, authenticated;
revoke execute on function public.notify_on_news_post()                 from public, anon, authenticated;
revoke execute on function public.notify_on_new_lesson()                from public, anon, authenticated;
revoke execute on function public.notify_on_comment_reply()             from public, anon, authenticated;
revoke execute on function public.touch_suppliers_updated_at()          from public, anon, authenticated;
revoke execute on function public.touch_inspiration_posts_updated_at()  from public, anon, authenticated;

-- Chamada de dentro de handle_new_user, que roda como SECURITY DEFINER.
revoke execute on function public.process_pending_payment_events(text)  from public, anon, authenticated;

-- ============================================================================
-- is_admin / is_enrolled / is_forum_member CONTINUAM executáveis de propósito:
-- as policies de RLS as chamam como o usuário da requisição e quebrariam sem
-- esta permissão. O analisador do Supabase sinaliza as três — é esperado.
-- Elas não vazam nada: respondem apenas sim/não sobre quem está chamando.
-- ============================================================================
grant execute on function public.is_admin()            to anon, authenticated;
grant execute on function public.is_enrolled(uuid)     to anon, authenticated;
grant execute on function public.is_forum_member(uuid) to anon, authenticated;
