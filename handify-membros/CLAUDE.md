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
- `src/app/(student)/cursos/page.tsx` — texto do Hero hardcoded; deveria vir de `static_pages` ou `site_config`

## Convenções

- TypeScript strict — sem `any` explícito
- Server Actions para mutações; API routes apenas para webhooks externos (`/api/webhooks/payt`)
- `use server` / `use client` explícito em todo arquivo que precisar
- Zod para validar todos os inputs de forms e webhooks
- Nunca retornar `video_panda_id` ou URL de vídeo sem verificar `enrollment` server-side
- CPF nunca exposto em JSON; apenas no PDF do certificado

## Fluxo de trabalho

- Ao final de cada alteração, sempre fazer `commit` e `push` para o remote.

## Embeds no menu

Quando a usuária pedir para embedar um site externo no menu, ela envia o link e eu crio uma página dedicada em `src/app/(student)/[nome]/page.tsx` que:
1. Autentica via Supabase server-side (`createClient`)
2. Redireciona para `/login` se não autenticada
3. Monta a URL com `?email=${encodeURIComponent(user.email ?? "")}` hardcoded no servidor
4. Renderiza um `<iframe>` que ocupa `calc(100svh - 104px)` entre header e footer

Nunca usar `/embed?url=...` — a URL de destino e o email ficam invisíveis na barra do navegador com páginas dedicadas.

## Segurança — checklist por PR

- [ ] Toda nova tabela Supabase tem RLS ativo
- [ ] Server Actions verificam role antes de mutar
- [ ] Inputs sanitizados (Zod + DOMPurify onde aplicável)
- [ ] Nenhum segredo exposto no client (`NEXT_PUBLIC_` apenas para Supabase URL e anon key)

## Segurança — correções aplicadas (pré-lançamento)

| Data | Arquivo | Problema | Fix |
|------|---------|----------|-----|
| 2026-06-24 | `src/lib/sanitize/index.ts` | Atributo `style` no ALLOWED_ATTR permitia CSS injection via blocos de aula criados pelo admin | Removido `"style"` da lista; usar classes CSS ao invés de estilos inline |
| 2026-06-24 | `src/app/(student)/comunidade/forum/actions.ts` | Upload aceitava qualquer tipo de arquivo — aluna podia fazer upload de arquivo malicioso renomeado como imagem | Adicionada validação de MIME type: só aceita `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| 2026-06-24 | `src/lib/notifications/actions.ts` | `getUnreadCount` e `getNotifications` usavam service client com `userId` vindo do caller sem verificar a sessão — qualquer aluna autenticada podia ler notificações de outra | Adicionada verificação `user.id === userId` antes de consultar; retorna vazio silenciosamente se não bater |
