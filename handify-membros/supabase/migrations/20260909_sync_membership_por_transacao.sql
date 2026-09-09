-- Mesma falha de 09/09, agora na função do banco.
--
-- sync_membership_from_payments considerava a compra do plano "desfeita" se
-- existisse QUALQUER evento de cancelamento daquele e-mail para um código do
-- plano depois da compra. Um PIX abandonado do mesmo produto entrava nessa
-- conta e a aluna perdia o Handify Completo sem nunca ter pedido reembolso.
--
-- A pergunta certa é sobre a transação: estorno é o MESMO transaction_id
-- passando por paid e depois por refunded/chargeback/canceled. PIX abandonado
-- nunca teve um paid com aquele id.
--
-- Já aplicada em produção em 09/09/2026 junto com a restauração de
-- veronicamacielpneus@hotmail.com e claramaiscamila@gmail.com (22 cursos cada).
create or replace function public.sync_membership_from_payments(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_email  text;
  v_compra record;
begin
  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then return false; end if;
  if public.has_active_membership(p_user_id) then return false; end if;

  select pe.created_at, pe.platform into v_compra
  from public.payment_events pe
  where lower(pe.buyer_email) = lower(v_email)
    and pe.event_type in ('paid', 'approved', 'completed', 'confirmed', 'order_approved', 'subscription_renewed')
    and public.is_plan_code(pe.product_code)
    and not exists (
      select 1 from public.payment_events r
      where r.payload->>'transaction_id' is not null
        and r.payload->>'transaction_id' = pe.payload->>'transaction_id'
        and r.event_type in ('refunded', 'order_refunded', 'chargeback', 'canceled', 'cancelled',
                             'subscription_canceled', 'subscription_late')
    )
  order by pe.created_at
  limit 1;

  if not found then return false; end if;

  insert into public.memberships (user_id, plan, source, granted_at, reason)
  values (
    p_user_id,
    'completo',
    case when lower(coalesce(v_compra.platform, '')) = 'kiwify' then 'kiwify' else 'payt' end::public.membership_source,
    v_compra.created_at,
    'compra do plano em payment_events'
  );
  return true;
end;
$$;

revoke execute on function public.sync_membership_from_payments(uuid) from public, anon, authenticated;
grant execute on function public.sync_membership_from_payments(uuid) to service_role;
