-- ─── E-mail gravado em minúsculas, sempre ────────────────────────────────────
--
-- O código inteiro procura conta com `.eq("email", email.toLowerCase())` — são
-- 15 lugares, da recuperação de senha ao vínculo da compra com a matrícula.
-- Todos eles partem de um acordo que nada no banco obrigava.
--
-- Um perfil quebrou o acordo: `Francine_sa@hotmail.com`, com F maiúsculo, no
-- auth em minúsculas. Para essa aluna a recuperação de senha respondia "este
-- e-mail não está cadastrado" — e o `recovery_sent_at` nulo dela mostra que
-- nunca passou dali. São 3 cursos comprados atrás de uma porta que não abre.
--
-- A regra nova mora aqui, não em cada chamada: quem gravar maiúscula, grava
-- minúscula do mesmo jeito.

-- ── 1. Normaliza o que já está gravado ───────────────────────────────────────
update public.profiles
   set email = lower(btrim(email))
 where email is not null and email <> lower(btrim(email));

update public.activation_tokens
   set email = lower(btrim(email))
 where email is not null and email <> lower(btrim(email));

-- ── 2. O gatilho que impede a próxima ────────────────────────────────────────
create or replace function public.email_minusculo()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end;
$$;

comment on function public.email_minusculo() is
  'Normaliza e-mail na gravação. O código compara com lower() em todo lugar; isto é o que faz essa comparação valer.';

drop trigger if exists profiles_email_minusculo on public.profiles;
create trigger profiles_email_minusculo
  before insert or update of email on public.profiles
  for each row execute function public.email_minusculo();

drop trigger if exists activation_tokens_email_minusculo on public.activation_tokens;
create trigger activation_tokens_email_minusculo
  before insert or update of email on public.activation_tokens
  for each row execute function public.email_minusculo();

-- ── 3. Um perfil por e-mail, e a busca deixa de varrer a tabela ──────────────
--
-- `profiles.email` não tinha índice nenhum — nem único. Conta duplicada era o
-- estrago do incidente de 10/09, e nada no banco a barrava. Hoje não existe
-- duplicata (4.557 perfis, 0 repetidos), então o índice entra limpo.
create unique index if not exists profiles_email_unico
  on public.profiles (lower(email))
  where email is not null;
