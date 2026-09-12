-- ─── Achar a compra quando a aluna digita o próprio e-mail errado ────────────
--
-- Caso que originou isto (Germana, 10/09/2026):
--   13:10  Payt confirma o pagamento de germapadilha_@hotmail.com
--   13:22  a aluna se cadastra e digita germanapadilha_@hotmail.com (um "n" a mais)
--   13:56  ela entra e não vê curso nenhum
--   14:48  a admin cria uma SEGUNDA conta com o e-mail da compra e libera 3 cursos
--   12/09  a admin desiste e dá os 3 cursos à conta que ela de fato usa
--
-- Nos dois cadastros o telefone era o mesmo (81999205815) e o nome era o mesmo
-- ("Germana Almeida Padilha de Oliveira"). A plataforma tinha como ligar os dois
-- e não ligou, porque só procurava a compra pelo e-mail exato.
--
-- Varredura de 12/09: 7 alunas pagantes estão sem curso agora por causa disso —
-- 43 matrículas, a mais antiga parada há 41 dias. Vilma comprou o pacote inteiro
-- escrevendo "hormail.com" e está com 23 cursos travados há 24 dias.
--
-- Estas colunas deixam o telefone comparável (só dígitos, sem o 55 de país) e
-- indexado, para o webhook e o cadastro cruzarem compra × conta sem varrer tabela.

-- O 55 só é retirado quando o número tem 12 ou 13 dígitos — é o comprimento de
-- um telefone brasileiro COM o código do país. Um celular de 11 dígitos que por
-- acaso comece com 55 (DDD 55, Santa Maria/RS) fica intacto.
create or replace function public.telefone_comparavel(bruto text)
returns text
language sql
immutable
as $$
  select case
    when bruto is null then null
    when length(regexp_replace(bruto, '\D', '', 'g')) in (12, 13)
         and left(regexp_replace(bruto, '\D', '', 'g'), 2) = '55'
      then substr(regexp_replace(bruto, '\D', '', 'g'), 3)
    else nullif(regexp_replace(bruto, '\D', '', 'g'), '')
  end;
$$;

comment on function public.telefone_comparavel(text) is
  'Telefone só com dígitos e sem o 55 de país, para comparar compra × cadastro.';

alter table public.activation_tokens
  add column if not exists buyer_phone_norm text
  generated always as (public.telefone_comparavel(buyer_phone)) stored;

alter table public.profiles
  add column if not exists phone_norm text
  generated always as (public.telefone_comparavel(phone)) stored;

-- Índice parcial: só telefone utilizável (DDD + número). Abaixo de 10 dígitos
-- não dá para afirmar que é a mesma pessoa.
create index if not exists activation_tokens_phone_norm_idx
  on public.activation_tokens (buyer_phone_norm)
  where buyer_phone_norm is not null and length(buyer_phone_norm) >= 10;

create index if not exists profiles_phone_norm_idx
  on public.profiles (phone_norm)
  where phone_norm is not null and length(phone_norm) >= 10;

comment on column public.profiles.phone_norm is
  'Gerada. Usada para achar conta duplicada e ligar a compra ao cadastro.';
comment on column public.activation_tokens.buyer_phone_norm is
  'Gerada. Telefone do comprador, comparável com profiles.phone_norm.';
