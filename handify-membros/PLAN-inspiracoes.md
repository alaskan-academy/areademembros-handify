# Plano — Inspirações + Avisos (Feed Unificado)

> Documento de referência para implementação da nova seção de Inspirações e separação dos Avisos.
> Não alterar nenhum arquivo de código sem consultar este plano.

---

## Contexto e Decisões

### O que muda
| Antes | Depois |
|---|---|
| `/comunidade/feed` — mistura avisos + inspirações | `/inspiracoes` — feed visual estilo Instagram (só Handify posta) |
| `biblioteca-handify` — site estático separado (8 posts em JSON) | Migrado para `inspiration_posts` no banco |
| Sem bookmarks | Bookmark por post |
| Sem busca no feed | Busca por palavra-chave + filtro por nicho e curso |

### Decisões fixadas
- **Opção A**: `news_posts` vira Avisos (sem tocar no banco), nova tabela `inspiration_posts`
- **Avisos**: área separada com sino/push/email — comportamento do feed atual preservado
- **Inspirações**: notificação opt-in (preferência no perfil)
- **Comentários**: passam por moderação antes de aparecer publicamente
- **PDF Export**: preservado para posts do tipo `receita` (herança da biblioteca)
- **Biblioteca**: repo `alaskan-academy/biblioteca-handify` depreciado após migração

---

## Banco de Dados

### Migration 033 — Tabelas de Inspirações

```sql
-- Post principal
CREATE TABLE inspiration_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           uuid NOT NULL REFERENCES profiles(id),
  type                text NOT NULL CHECK (type IN ('foto','carrossel','video','receita','dica','destaque')),
  title               text NOT NULL,
  body                text,
  -- Mídia
  media               jsonb DEFAULT '[]',   -- [{url, alt, order}] para foto/carrossel
  video_url           text,                 -- URL YouTube ou Panda Video
  -- Blocos HTML (mesmo padrão de lesson_content_blocks)
  blocks              jsonb DEFAULT '[]',   -- [{type, content, position}]
  -- Receita (herança da biblioteca)
  recipe_data         jsonb,               -- {ingredientes, passos, tempo, temperatura, nivel, paleta_cores, custo_medio, preco_venda, dicas}
  -- Categorização
  tags                text[] DEFAULT '{}', -- nichos: velas, sabonetes, costura, etc.
  course_id           uuid REFERENCES courses(id) ON DELETE SET NULL,
  -- Destaque de aluna
  featured_student_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Publishing
  published           boolean DEFAULT false,
  archived            boolean DEFAULT false,
  pinned              boolean DEFAULT false,
  -- Auditoria
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Likes
CREATE TABLE inspiration_likes (
  post_id   uuid REFERENCES inspiration_posts(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- Bookmarks (salvar)
CREATE TABLE inspiration_bookmarks (
  post_id    uuid REFERENCES inspiration_posts(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Comentários com moderação
CREATE TABLE inspiration_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES inspiration_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  approved   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Full-text search (pg_trgm)
CREATE INDEX inspiration_posts_search_idx ON inspiration_posts
  USING gin((title || ' ' || coalesce(body,'')) gin_trgm_ops);

-- RLS em todas as tabelas
ALTER TABLE inspiration_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_comments  ENABLE ROW LEVEL SECURITY;
```

### Migration 034 — Seed da Biblioteca (8 posts)

Script que importa os 8 posts do `data/posts.json` da biblioteca para `inspiration_posts`.

Mapeamento de campos:
| Biblioteca | `inspiration_posts` |
|---|---|
| `tipo: receita` | `type: 'receita'` |
| `tipo: inspiracao` | `type: 'foto'` |
| `categoria` | `tags[]` (ex: `['sabonetes']`) |
| `foto_url` | `media[0].url` |
| `titulo` | `title` |
| `descricao` | `body` |
| `ingredientes + passos + dicas + paleta + custo + preco` | `recipe_data` (jsonb) |
| `ctas` | não migrado (cursos podem ter IDs diferentes) |

### Atualização em `notification_types` (perfil opt-in)

Adicionar `inspiration_post` em `profiles.email_prefs`.

---

## Tipos de Post

| Tipo | Descrição | Campos especiais |
|---|---|---|
| `foto` | Imagem única + legenda | `media[0]` |
| `carrossel` | 2+ imagens swipeable | `media[]` ordenado |
| `video` | URL YouTube/Panda embedado | `video_url` |
| `receita` | Receita com ingredientes e passos | `recipe_data` + PDF export |
| `dica` | Texto rico + imagem opcional | `blocks` HTML |
| `destaque` | Aluna em Destaque | `featured_student_id` |

---

## Rotas

### Alunas
```
/inspiracoes               → feed principal (scroll infinito, filtros)
/inspiracoes/salvos        → posts salvos (bookmarks da aluna)
```

### Admin
```
/admin/inspiracoes                → lista de posts (com busca e filtros)
/admin/inspiracoes/novo           → criar post
/admin/inspiracoes/[id]           → editar post
/admin/inspiracoes/comentarios    → moderação de comentários
```

### Avisos (paths existentes renomeados na UI)
```
/comunidade/feed           → vira /avisos (redirect 301 ou renomear rota)
```

---

## Estrutura de Componentes

```
src/
  app/
    (student)/
      inspiracoes/
        page.tsx               ← feed principal
        salvos/
          page.tsx             ← bookmarks
    (admin)/
      admin/
        inspiracoes/
          page.tsx             ← lista
          novo/
            page.tsx           ← criar
          [id]/
            page.tsx           ← editar
          comentarios/
            page.tsx           ← moderação

  components/
    inspiracoes/
      InspiracaoCard.tsx       ← card do feed (imagem, likes, save, comentários)
      InspiracaoFeed.tsx       ← container com scroll infinito + filtros
      InspiracaoFiltros.tsx    ← filtros: nicho + curso + busca
      InspiracaoCarrossel.tsx  ← swipe de imagens (tipo Stories)
      InspiracaoVideoEmbed.tsx ← embed YouTube/Panda
      InspiracaoModal.tsx      ← detalhe completo do post (drawer/modal)
      ComentariosPanel.tsx     ← lista + formulário de comentários
      LikeButton.tsx           ← coração animado
      BookmarkButton.tsx       ← salvar/remover
      ReceitaPDF.tsx           ← exportação PDF (herança da biblioteca)
    admin/
      inspiracoes/
        InspiracaoForm.tsx     ← formulário completo (todos os tipos)
        MediaUploader.tsx      ← upload de imagens com reordenação drag-drop
        VideoUrlInput.tsx      ← input URL + preview embutido
        InspiracaoBlocksEditor.tsx ← blocos HTML (reaproveitando padrão das aulas)
        ComentariosModeracao.tsx   ← tabela de comentários pendentes

  lib/
    inspiracoes/
      actions.ts               ← Server Actions (CRUD, likes, bookmarks, comentários)
      types.ts                 ← tipos TypeScript
```

---

## UX/UI — Feed das Alunas

### Layout do card (mobile-first)
```
┌─────────────────────────────┐
│  [avatar] Handify  · 2d     │  ← header fixo
├─────────────────────────────┤
│                             │
│         IMAGEM              │  ← 1:1 ou 4:5 (como Instagram)
│    (swipe se carrossel)     │
│                             │
├─────────────────────────────┤
│  ♡ 24   💬 3   🔖           │  ← ações
│  Título do post             │
│  Legenda curta...  ver mais │
│  [🕯️ Velas] [Curso X]      │  ← tags clicáveis
└─────────────────────────────┘
```

### Filtros (topo, scroll horizontal)
```
[🔍 Buscar...]
[Todos] [🕯️ Velas] [🧼 Sabonetes] [✂️ Costura] [📚 Curso ▾]
```

### Modal de detalhe
- Abre ao clicar no card
- Header: imagem grande (ou carrossel) / vídeo
- Body: título, texto completo, tags
- Para `receita`: ingredientes + passos + paleta + botão "Exportar PDF"
- Footer: likes, comentários

---

## UX/UI — Admin

### Formulário de post
1. **Tipo** — selector de cards visuais (Foto / Carrossel / Vídeo / Receita / Dica / Destaque)
2. **Título** obrigatório
3. **Mídia** (condicional por tipo):
   - Foto/Carrossel: dropzone com preview + drag para reordenar
   - Vídeo: campo URL com embed ao vivo
4. **Corpo** — textarea rich text
5. **Blocos HTML** — editor de blocos (mesmo padrão das aulas)
6. **Tags de nicho** — chips: Velas, Sabonetes, Costura...
7. **Curso relacionado** — select (opcional)
8. **Dados de receita** (aparece só se tipo = receita): ingredientes, passos, tempo, temperatura, nível, paleta
9. **Opções**: Publicado / Fixado / Aluna em Destaque
10. **Ações**: Salvar rascunho | Publicar | Arquivar

---

## Notificações

| Evento | Canal | Comportamento |
|---|---|---|
| Novo post de inspiração publicado | Push + Email | Opt-in (padrão: desligado) |
| Novo aviso (`news_posts`) | Push + Email + Sino | Sempre ativo (comportamento atual) |
| Resposta ao seu comentário | Push + Sino | Sempre ativo |

---

## Fases de Implementação

### Fase 1 — Banco e tipos
- [ ] Migration 033: tabelas `inspiration_posts`, likes, bookmarks, comentários + RLS
- [ ] Migration 034: seed dos 8 posts da biblioteca
- [ ] `lib/inspiracoes/types.ts` e `actions.ts`

### Fase 2 — Admin
- [ ] Lista de posts com busca/filtro
- [ ] Formulário completo (todos os tipos, carrossel, vídeo, blocos HTML)
- [ ] Moderação de comentários
- [ ] Sidebar + atalhos no dashboard admin

### Fase 3 — Feed das alunas
- [ ] Página `/inspiracoes` com cards visuais
- [ ] Filtros (nicho + curso + busca)
- [ ] Modal de detalhe
- [ ] Likes e bookmarks
- [ ] Comentários
- [ ] Scroll infinito (paginação por cursor)

### Fase 4 — Avisos e navegação
- [ ] Renomear `/comunidade/feed` → `/avisos` na UI (manter rota ou criar redirect)
- [ ] Atualizar sidebar e menu para refletir nova estrutura
- [ ] Adicionar "Inspirações" ao menu principal
- [ ] Badge de avisos não lidos separado das inspirações

### Fase 5 — Funcionalidades extras
- [ ] PDF export para posts tipo `receita`
- [ ] Página `/inspiracoes/salvos` (bookmarks)
- [ ] Integrar ao global search (`pg_trgm`)
- [ ] Notificação opt-in em `email_prefs`

---

## Avisos — O que NÃO muda

A tabela `news_posts` e toda a lógica de notificação existente **não são tocadas**.
Apenas a UI muda:
- Label no sidebar: "Feed" → "Avisos"
- Rota pode manter `/comunidade/feed` ou criar `/avisos` com redirect

---

## Checklist de Segurança (por fase)

- [ ] RLS ativo em todas as novas tabelas
- [ ] `inspiration_comments.approved = false` por padrão (moderação obrigatória)
- [ ] Likes e bookmarks verificam `user_id` da sessão (não confiar em parâmetro)
- [ ] Upload de imagens: validar MIME type antes de salvar no Storage
- [ ] Blocos HTML: DOMPurify com allowlist (mesmo padrão das aulas)
- [ ] Admin actions verificam `role = 'admin'`
