-- A auditoria de 02/09 renomeou product_codes -> checkout_codes no codigo, mas
-- a coluna de migration_candidates ficou com o nome antigo. Como o PostgREST
-- devolve erro quando a coluna nao existe, o select do passo 2 de /ativar
-- retornava data = null e a aluna via "Link invalido ou expirado".
--
-- Efeito em producao entre 02/09 22:31 e 08/09: nenhuma matricula de migracao
-- foi concedida e 11 alunas travaram na ativacao.

alter table public.migration_candidates
  rename column product_codes to checkout_codes;
