# Inspirações + Avisos — Notas de Implementação

> Leia este arquivo antes de qualquer alteração relacionada ao feed de Inspirações ou Avisos.
> Plano completo em: `PLAN-inspiracoes.md`

## Escopo desta feature

Unificação da `biblioteca-handify` (repo separado, 8 posts em JSON) com o feed de inspirações,
transformando o atual `/comunidade/feed` em dois espaços distintos:

- `/inspiracoes` — feed visual estilo Instagram (só Handify posta), com filtros, likes, bookmarks e comentários moderados
- `/avisos` — área de recados admin (antigo feed), sem mudança no banco

## Tabelas novas (não tocar antes da migration 033)

```
inspiration_posts      ← posts do feed visual
inspiration_likes      ← curtidas
inspiration_bookmarks  ← posts salvos por aluna
inspiration_comments   ← comentários com approved=false por padrão
```

## Tabelas que NÃO mudam

`news_posts` e `news_comments` — continuam sendo Avisos. Só a UI muda (label no sidebar).

## Tipos de post suportados

`foto` | `carrossel` | `video` | `receita` | `dica` | `destaque`

- `receita`: tem `recipe_data` jsonb com ingredientes, passos, etc. — herdado da biblioteca
- `carrossel`: `media[]` ordenado, renderizado com swipe (tipo Stories)
- `video`: `video_url` detecta automaticamente YouTube vs Panda Video para embed correto
- `destaque`: referencia `featured_student_id` (perfil de aluna)

## Pastas e arquivos

```
src/components/inspiracoes/        ← componentes do feed (aluna)
src/components/admin/inspiracoes/  ← formulário e moderação (admin)
src/app/(student)/inspiracoes/     ← rotas da aluna
src/app/(admin)/admin/inspiracoes/ ← rotas admin
src/lib/inspiracoes/               ← types.ts + actions.ts
supabase/migrations/033_*          ← tabelas
supabase/migrations/034_*          ← seed biblioteca
```

## Padrões obrigatórios

- Comentários: `approved = false` por padrão — nunca exibir sem aprovação admin
- Imagens upload: validar MIME type (jpeg/png/webp/gif apenas)
- Blocos HTML: DOMPurify com allowlist (mesmo padrão de `src/lib/sanitize/index.ts`)
- Likes/bookmarks: verificar `user.id` da sessão server-side, nunca aceitar do client
- Scroll infinito: paginação por cursor (`created_at` DESC + `id`), não por offset
- Admin actions: verificar `role = 'admin'` antes de qualquer mutação

## Notificações

- Novo post de inspiração → tipo `inspiration_post` → **opt-in** (padrão: desligado)
- Novo aviso (`news_posts`) → comportamento atual preservado (sempre ativo)
- Comentário respondido → tipo existente, sempre ativo

## PDF Export (receitas)

Preservar a funcionalidade de exportação PDF da biblioteca original.
Gerar no servidor (ou browser via jsPDF) com:
- Logo Handify™ vertical com ™
- Faixa tricolor no topo
- Marca d'água diagonal com email da aluna
- Ingredientes, passos, dicas, paleta de cores

## Migração da biblioteca

8 posts em `data/posts.json` do repo `alaskan-academy/biblioteca-handify`:
- 5 receitas (tipo `receita`) — Sabonetes (4) + Velas (1)
- 3 inspirações (tipo `foto`) — Sabonetes (2) + Velas (1)

Após migration 034 rodada e validada, deprecar o repo biblioteca-handify.

## Ordem de implementação (não pular fases)

1. Migrations 033 + 034 (banco primeiro, sempre)
2. `lib/inspiracoes/types.ts` + `actions.ts`
3. Admin: formulário + lista + moderação
4. Feed da aluna: cards + filtros + modal + likes + bookmarks
5. Avisos: renomear na UI
6. Extras: PDF, salvos, global search, notificações opt-in
