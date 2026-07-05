# Plano: Métricas de Engajamento + Aba Atividade por Aluna

## Contexto

O admin precisa enxergar quem são as alunas mais ativas na comunidade e conseguir ver, por aluna, um histórico completo de tudo que ela fez (posts no fórum, comentários no feed, sugestões de fornecedores, aulas concluídas). Hoje esses dados existem no banco mas não há nenhuma tela que os consolide.

Tabelas de engajamento confirmadas:
- `forum_posts` — posts de alunas em fóruns por curso
- `forum_comments` — comentários/respostas em posts do fórum
- `news_comments` — comentários em posts do feed de notícias
- `supplier_suggestions` — sugestões de fornecedores enviadas por alunas
- `post_likes` — curtidas polimórficas (sem `created_at` — não filtrável por período)
- `lesson_progress` — progresso de aulas (completed=true para aulas concluídas)

---

## O que será entregue

### B — Aba "Atividade" em `/admin/alunos/[id]`

O perfil de cada aluna ganha duas abas: **Perfil** (conteúdo atual) e **Atividade** (timeline nova).

A tab Atividade exibe uma timeline cronológica unificada de todas as ações da aluna:

| Ícone | Tipo | Fonte |
|-------|------|-------|
| 💬 | Post no fórum | `forum_posts` |
| 🗨️ | Comentário no fórum | `forum_comments` |
| 📣 | Comentário no feed | `news_comments` |
| 🏪 | Sugestão de fornecedor | `supplier_suggestions` |
| ✅ | Aula concluída | `lesson_progress` (completed=true) |

Cada item mostra: tipo, preview do conteúdo (truncado), data, link para o contexto.

Acima da timeline: resumo rápido em chips (X posts · Y comentários · Z sugestões · W aulas concluídas · pontuação total).

### C — Dashboard `/admin/metricas/engajamento`

Nova página com:
1. **Cards de resumo** (total do período): posts, comentários, sugestões, aulas concluídas
2. **Ranking top 20 alunas** por pontuação de engajamento, com breakdown visual
3. **Filtro de período**: 7 dias / 30 dias / Todo o tempo (via `?periodo=7d` como searchParam)
4. Cada linha do ranking linka para `/admin/alunos/[id]?tab=atividade`

**Fórmula de pontuação:**
```
score = forum_posts × 3 + forum_comments × 2 + news_comments × 2 + suggestions × 3
```
*(post_likes excluído da fórmula — tabela sem `created_at`, não suporta filtro por período)*

---

## Padrão arquitetural (seguindo o codebase)

O projeto usa **parallel queries + in-memory aggregation** (sem UNION). Exemplo em `metricas/alunas/page.tsx`:
```ts
const [{ data: progressAll }, { data: certs }, ...] = await Promise.all([...])
// depois agrega em JS com Maps
```

Mesmo padrão para o novo código. Tudo usa `createServiceClient()` (service role, bypassa RLS).

---

## Arquivos a criar

### 1. `src/app/(admin)/admin/metricas/engajamento/page.tsx`
Server component. Lê `?periodo` dos searchParams. Faz 5 queries em paralelo com `.gte("created_at", since)` onde aplicável. Agrega em JS por `user_id`, calcula score, ordena desc, pega top 20. Passa para `EngajamentoPage`.

### 2. `src/components/admin/metrics/EngajamentoPage.tsx`
Client component. Recebe ranking + resumos + período atual. Renderiza:
- Seletor de período (3 botões toggle → `router.replace` com novo searchParam)
- Cards de totais
- Tabela de ranking com avatar, nome, score total, breakdown por tipo (mini-bars ou chips), link para perfil

### 3. `src/components/admin/alunos/ActivityTab.tsx`
Client component. Recebe array de `ActivityItem[]` já ordenado por data desc. Renderiza timeline com ícone por tipo, preview, data relativa (ex: "há 3 dias"), link externo para o contexto quando disponível.

---

## Arquivos a modificar

### 4. `src/app/(admin)/admin/alunos/[userId]/page.tsx`
Adicionar 5 queries em paralelo ao `Promise.all` existente:
```ts
service.from("forum_posts").select("id, title, body, created_at, approved").eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
service.from("forum_comments").select("id, body, created_at, post_id, forum_posts!post_id(title, forum_id)").eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
service.from("news_comments").select("id, body, created_at, post_id, news_posts!post_id(title)").eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
service.from("supplier_suggestions").select("id, name, url, status, created_at").eq("user_id", userId).order("created_at", { ascending: false })
service.from("lesson_progress").select("id, lesson_id, completed, updated_at, lessons!lesson_id(title, modules!module_id(courses!course_id(title)))").eq("user_id", userId).eq("completed", true).order("updated_at", { ascending: false }).limit(50)
```
Passar os dados como prop nova (`activity`) para `AlunaDetail`.

### 5. `src/app/(admin)/admin/alunos/[userId]/aluna-detail.tsx`
- Adicionar sistema de abas (`useState<'perfil' | 'atividade'>`)
- Tab "Perfil" = conteúdo atual inalterado
- Tab "Atividade" = `<ActivityTab items={activity} />`
- Aceitar `?tab=atividade` via `useSearchParams` para abrir direto na tab certa (necessário para o link do ranking do dashboard)

### 6. Admin nav (componente de navegação lateral do admin)
Adicionar link "Engajamento" sob o agrupamento de Métricas. Identificar o arquivo de nav admin (provavelmente `src/components/admin/AdminNav.tsx` ou similar — localizar antes de editar).

---

## Tipos TypeScript (novos)

```ts
// ActivityItem — unificado para a timeline
type ActivityItem = {
  id: string
  type: 'forum_post' | 'forum_comment' | 'news_comment' | 'suggestion' | 'lesson_completed'
  content: string        // título do post ou texto do comentário (truncado a 120 chars)
  context?: string       // título do post pai (para comentários) ou curso (para aulas)
  link?: string          // URL interna para ver no contexto
  status?: string        // 'pending' | 'approved' | 'rejected' (para sugestões)
  date: string           // ISO string para ordenar e exibir
}

// EngajamentoEntry — para o ranking
type EngajamentoEntry = {
  userId: string
  profile: { full_name: string | null; email: string; avatar_url: string | null }
  score: number
  forumPosts: number
  forumComments: number
  newsComments: number
  suggestions: number
}
```

---

## Notas para gamificação futura (fora do escopo atual)

Quando a feature for expandida para as alunas verem o próprio engajamento:
- Adicionar `engagement_score` (int, calculado por trigger ou cron) em `profiles` ou tabela separada `engagement_scores`
- Badges: primeira postagem, 10 aulas concluídas, 5 comentários, etc. → tabela `badges` + `user_badges`
- Leaderboard opt-in na comunidade → flag `show_in_leaderboard` em `profiles`
- O componente `ActivityTab` pode ser reutilizado no perfil público da aluna com filtro de privacidade

---

## Verificação pós-implementação

1. `/admin/metricas/engajamento` carrega sem erro e exibe ranking com alunos reais
2. Trocar período (7d / 30d / todos) atualiza os números sem reload total
3. Clicar em aluna do ranking abre `/admin/alunos/[id]?tab=atividade` diretamente na tab correta
4. Tab Atividade exibe timeline mista com posts, comentários, sugestões e aulas concluídas em ordem cronológica
5. Aluna sem atividade mostra estado vazio elegante
6. Build sem erros TypeScript (`npm run build`)
