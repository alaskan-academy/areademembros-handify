-- Menu por tier: visitante · aluna · completo · admin.
-- Contexto em .claude/plans/tiers-handify.md (fase 3).
--
-- `menu_visibility` tinha guest | student | admin. "guest" era letra morta
-- (tudo exige login) e "student" valia para qualquer conta. Os nomes novos dizem
-- o que cada tier e; a admin decide item a item, sem deploy.
--
-- Dois passos porque valor novo de enum nao pode ser usado na mesma transacao
-- em que foi criado:
--   1) adicionar os valores;
--   2) migrar as linhas.
--
-- Tiers so adicionam: tudo que aparecia para qualquer conta (guest e student)
-- vira "visitante", o tier mais baixo — ninguem perde item de menu. Subir um
-- item para "aluna" ou "completo" e decisao da Jessica, no painel.

-- Passo 1
alter type public.menu_visibility add value if not exists 'visitante';
alter type public.menu_visibility add value if not exists 'aluna';
alter type public.menu_visibility add value if not exists 'completo';

-- Passo 2 (aplicar depois do passo 1 commitar)
-- update public.menu_items set visible_to = 'visitante' where visible_to in ('guest', 'student');
