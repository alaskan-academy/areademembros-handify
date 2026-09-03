-- Rede de segurança que roda quando a aluna cria conta: procura compras dela
-- que chegaram antes do cadastro e libera o acesso.
--
-- A versão anterior tinha quatro defeitos:
--   1. Liberava acesso para QUALQUER evento não processado — inclusive
--      waiting_payment (PIX gerado e não pago), expired e canceled.
--      Três alunas receberam curso de R$97 sem pagar por causa disso.
--   2. Gravava source = 'payt' fixo, rotulando errado as vendas da Kiwify.
--   3. Comparava e-mail e código de produto sem ignorar maiúsculas —
--      os ids da Kiwify são UUID e chegam nas duas grafias.
--   4. Considerava só um curso por evento, ignorando o resto de um combo.
create or replace function public.process_pending_payment_events(p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event   record;
  v_course  record;
  v_user_id uuid;
  v_liberou boolean;
begin
  select id into v_user_id
  from public.profiles
  where lower(email) = lower(p_email)
  limit 1;

  if v_user_id is null then return; end if;

  for v_event in
    select id, product_code, platform
    from public.payment_events
    where lower(buyer_email) = lower(p_email)
      and processed = false
      and error is null
      -- Só pagamento efetivamente aprovado libera acesso.
      and event_type in (
        'paid', 'approved', 'completed', 'confirmed',   -- Payt
        'order_approved', 'subscription_renewed'        -- Kiwify
      )
  loop
    v_liberou := false;

    -- Um evento pode liberar mais de um curso (combo/agrupado).
    for v_course in
      select c.id, c.access_days
      from public.courses c
      where lower(v_event.product_code) = any (
        select lower(code) from unnest(c.product_codes) as code
      )
    loop
      insert into public.enrollments (user_id, course_id, source, granted_at, expires_at)
      values (
        v_user_id,
        v_course.id,
        coalesce(nullif(v_event.platform, ''), 'payt')::enrollment_source,
        now(),
        case when v_course.access_days is null then null
             else now() + (v_course.access_days || ' days')::interval end
      )
      on conflict (user_id, course_id) do nothing;

      v_liberou := true;
    end loop;

    if v_liberou then
      update public.payment_events set processed = true where id = v_event.id;
    end if;
  end loop;
end;
$function$;

-- Continua fechada para a API: só handle_new_user a chama, como SECURITY DEFINER.
revoke execute on function public.process_pending_payment_events(text) from public, anon, authenticated;
