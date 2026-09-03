-- ETAPA 1 de 2 — renomeação compatível com o código antigo.
--
-- "Produto" significava duas coisas sem relação neste banco:
--   products              = materiais de artesanato dos fornecedores (cera, pavio)
--   courses.product_codes = códigos de checkout da Payt e da Kiwify
--   banners.product_codes = idem, para esconder banner de quem já comprou
--
-- Quem procurasse "os produtos que a Handify vende" achava a tabela de insumos.
--
-- Esta etapa mantém nomes antigos e novos funcionando ao mesmo tempo, porque o
-- código em produção só passa a usar os novos depois do deploy.
-- A etapa 2 remove os antigos e só deve rodar DEPOIS do deploy.

-- ── Tabela: products -> supplier_products ───────────────────────────────────
alter table public.products rename to supplier_products;

-- View com o nome antigo. security_invoker faz o RLS valer para quem chama.
-- Verificado: o PostgREST continua resolvendo os embeds (products(...)) pela
-- FK da tabela por baixo, então a página de fornecedores não quebra.
create view public.products with (security_invoker = true) as
  select * from public.supplier_products;

grant select, insert, update, delete on public.products to anon, authenticated, service_role;

-- ── courses.product_codes -> checkout_codes ─────────────────────────────────
-- View não serve aqui (o app consulta a tabela direto), então a coluna nova é
-- mantida em sincronia com a antiga por gatilho, nos dois sentidos.
alter table public.courses add column if not exists checkout_codes text[];
update public.courses set checkout_codes = product_codes
 where checkout_codes is distinct from product_codes;

create or replace function public.sync_courses_checkout_codes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.checkout_codes is null then new.checkout_codes := new.product_codes;
    elsif new.product_codes is null then new.product_codes := new.checkout_codes;
    end if;
  elsif new.checkout_codes is distinct from old.checkout_codes then
    new.product_codes := new.checkout_codes;
  elsif new.product_codes is distinct from old.product_codes then
    new.checkout_codes := new.product_codes;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_courses_checkout_codes on public.courses;
create trigger trg_sync_courses_checkout_codes
  before insert or update on public.courses
  for each row execute function public.sync_courses_checkout_codes();

revoke execute on function public.sync_courses_checkout_codes() from public, anon, authenticated;

-- ── banners.product_codes -> checkout_codes ─────────────────────────────────
alter table public.banners add column if not exists checkout_codes text[];
update public.banners set checkout_codes = product_codes
 where checkout_codes is distinct from product_codes;

create or replace function public.sync_banners_checkout_codes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.checkout_codes is null then new.checkout_codes := new.product_codes;
    elsif new.product_codes is null then new.product_codes := new.checkout_codes;
    end if;
  elsif new.checkout_codes is distinct from old.checkout_codes then
    new.product_codes := new.checkout_codes;
  elsif new.product_codes is distinct from old.product_codes then
    new.checkout_codes := new.product_codes;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_banners_checkout_codes on public.banners;
create trigger trg_sync_banners_checkout_codes
  before insert or update on public.banners
  for each row execute function public.sync_banners_checkout_codes();

revoke execute on function public.sync_banners_checkout_codes() from public, anon, authenticated;
