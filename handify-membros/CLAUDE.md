# Handify Membros — Dev Notes

PRD e arquitetura completa em: `../CLAUDE.md`
Plano de execução em: `../PLAN.md`

## Comandos

```bash
npm run dev      # desenvolvimento (http://localhost:3000)
npm run build    # build de produção
npm run lint     # ESLint
npm run test     # Vitest
```

## Variáveis de Ambiente

Copiar `.env.local.example` → `.env.local` e preencher antes de rodar.

## Princípio: Backend-first

**Tudo que aparece no front end deve estar configurado no backend (Supabase).**
Antes de hardcodar qualquer dado, verifique se existe (ou deve existir) uma tabela que o gerencie:

| O que               | De onde deve vir                          |
|---------------------|-------------------------------------------|
| Itens de menu/nav   | `menu_items` (CRUD admin, sem deploy)     |
| Banners             | `banners` (vigência, slot, product_codes) |
| Vitrine             | `showcase_courses` (ordem, vídeo vendas)  |
| Páginas estáticas   | `static_pages` (FAQ, Sobre, Termos)       |
| Categorias de curso | `categories`                              |
| Cursos e aulas      | `courses`, `modules`, `lessons`           |

Labels de status, aria-labels e UI strings genéricas podem ser constantes no código. Dados que o admin deve controlar sem deploy nunca podem ser hardcoded.

**Pendente de implementar (itens hardcoded identificados):**
- `src/components/student-header.tsx` L15 — `NAV_ITEMS` hardcoded; deve vir de `menu_items` (feature "Menu Editável" do PRD)
- `src/components/catalog-header.tsx` L28 — idem
- `src/app/(student)/cursos/page.tsx` L252 — texto do Hero hardcoded; deveria vir de `static_pages` ou `site_config`

## Convenções

- TypeScript strict — sem `any` explícito
- Server Actions para mutações; API routes apenas para webhooks externos (`/api/webhooks/payt`)
- `use server` / `use client` explícito em todo arquivo que precisar
- Zod para validar todos os inputs de forms e webhooks
- Nunca retornar `video_panda_id` ou URL de vídeo sem verificar `enrollment` server-side
- CPF nunca exposto em JSON; apenas no PDF do certificado

## Fluxo de trabalho

- Ao final de cada alteração, sempre fazer `commit` e `push` para o remote.

## Segurança — checklist por PR

- [ ] Toda nova tabela Supabase tem RLS ativo
- [ ] Server Actions verificam role antes de mutar
- [ ] Inputs sanitizados (Zod + DOMPurify onde aplicável)
- [ ] Nenhum segredo exposto no client (`NEXT_PUBLIC_` apenas para Supabase URL e anon key)
