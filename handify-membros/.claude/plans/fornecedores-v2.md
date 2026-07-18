# Plano — Fornecedores v2: Nichos + Produtos + Marcas

## Objetivo

Evoluir a página de fornecedores para um sistema de dois níveis:
- **Aba "Materiais"**: produtos específicos com links diretos de compra, filtrados por nicho
- **Aba "Lojas e Marcas"**: fornecedores existentes com "Ver site oficial"

Tudo relacionado — um produto conhece quais lojas o vendem. Uma loja conhece quais produtos tem.

---

## O que NÃO muda

- Tabelas `suppliers`, `supplier_channels`, `supplier_tags`, `supplier_reviews`,
  `supplier_favorites`, `supplier_suggestions` — **intactas**
- Todos os 46 fornecedores cadastrados — preservados
- Admin existente de fornecedores — mantido, apenas recebe nova seção

---

## Modelo de dados — novas tabelas

### `niches`
Agrupamento temático dos materiais. Ex: Velas, Sabonetes, Saponaria, Velaroma.

```sql
CREATE TABLE niches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  active     boolean NOT NULL DEFAULT true,
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `supplier_niche_links`
Qual nicho cada fornecedor cobre.

```sql
CREATE TABLE supplier_niche_links (
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  niche_id    uuid REFERENCES niches(id)    ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, niche_id)
);
```

### `products`
O material específico (ex: "Cera de carnaúba 1kg").

```sql
CREATE TABLE products (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  image_url text,
  active    boolean NOT NULL DEFAULT true,
  position  int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `product_niche_links`
Qual nicho cada produto pertence (muitos-para-muitos).

```sql
CREATE TABLE product_niche_links (
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  niche_id   uuid REFERENCES niches(id)   ON DELETE CASCADE,
  PRIMARY KEY (product_id, niche_id)
);
```

### `product_supplier_links`
O link de compra de um produto específico em um fornecedor específico.
Um produto pode ter vários fornecedores; cada um com seu próprio link.

```sql
CREATE TABLE product_supplier_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id)  ON DELETE CASCADE,
  buy_url     text NOT NULL,
  position    int NOT NULL DEFAULT 0,
  UNIQUE (product_id, supplier_id)
);
```

---

## Arquivos — novos

```
supabase/migrations/
  033_supplier_products.sql          ← todas as novas tabelas + RLS

src/lib/fornecedores/
  types.ts                           ← UPDATE: adiciona Niche, Product, ProductWithSuppliers
  actions.ts                         ← UPDATE: adiciona ações de nichos e produtos

src/components/ferramentas/fornecedores/
  FornecedoresPage.tsx               ← UPDATE: adiciona tabs Materiais | Lojas e Marcas
  MaterialCard.tsx                   ← NEW: card de produto (foto, nome, botões por loja)
  NichePills.tsx                     ← NEW: filtro de nichos em pílulas grandes

src/components/admin/
  AdminProdutosTable.tsx             ← NEW: tabela de produtos no admin

src/components/ferramentas/fornecedores/
  ProdutoForm.tsx                    ← NEW: formulário admin de produto (nome, foto, nichos, fornecedores + links)

src/app/(admin)/admin/fornecedores/
  page.tsx                           ← UPDATE: adiciona link "Produtos" no nav
  produtos/
    page.tsx                         ← NEW: lista de produtos admin
    novo/page.tsx                    ← NEW: criar produto
    [id]/page.tsx                    ← NEW: editar produto
```

---

## Arquivos — modificados

| Arquivo | O que muda |
|---------|------------|
| `src/lib/fornecedores/types.ts` | Adiciona `Niche`, `Product`, `ProductWithSuppliers`, `ProductSupplierLink` |
| `src/lib/fornecedores/actions.ts` | Adiciona `getNiches`, `getProducts`, `adminUpsertProduct`, `adminDeleteProduct`, `adminUpsertNiche` |
| `src/components/ferramentas/fornecedores/FornecedoresPage.tsx` | Adiciona tabs, integra `NichePills` e `MaterialCard` na aba Materiais; mantém cards na aba Lojas |
| `src/components/ferramentas/fornecedores/FornecedorCard.tsx` | Troca links de canais por botão único "Ver site oficial" (website > shopee > ML > instagram) |
| `src/app/(student)/ferramentas/fornecedores/page.tsx` | Busca nichos e produtos além de fornecedores |
| `src/app/(admin)/admin/fornecedores/page.tsx` | Adiciona nav link "Produtos" |

---

## UX aluna — aba Materiais

- Pílulas de nicho no topo (Velas · Sabonetes · Saponaria · …)
  - Se matriculada em um único curso, pré-seleciona o nicho correspondente
  - "Todos" mostra tudo
- Cards de produto: foto grande, nome, e para cada fornecedor que vende → botão "Comprar na [Loja X]"
  - Se só tiver um fornecedor: botão único "Comprar agora"
  - Se tiver vários: todos os botões empilhados
- Mobile-first: coluna única, botões largura total, fonte grande

## UX aluna — aba Lojas e Marcas

- Cards existentes com visual atual
- Substitui lista de links de canal por um único botão "Ver site oficial" (prioridade: website → shopee → ML → instagram)
- Remove filtros de canal e favoritos se ficarem confusos com as duas abas (avaliar na implementação)

---

## Admin — seção Produtos

### Listagem `/admin/fornecedores/produtos`
Tabela com: foto thumbnail, nome, nichos, quantidade de fornecedores vinculados, ativo/inativo, link de edição.

### Formulário de produto
- Nome (obrigatório)
- Foto (URL ou upload para Supabase Storage)
- Nichos (checkboxes)
- Fornecedores vinculados: lista dinâmica onde cada item é (fornecedor selecionado + URL de compra)
  - Botão "Adicionar fornecedor"
  - Pode remover individualmente

### Nav admin fornecedores
Adiciona link "Produtos" ao lado de "Comentários" e "Sugestões".

---

## Filtro por Curso (adicionado após v2 base)

### Objetivo
Permitir que a URL `/ferramentas/fornecedores?curso=slug-do-curso` filtre os materiais para um curso específico. O link pode ser colocado diretamente em aulas — a aluna chega na página já filtrada.

### Nova tabela: `product_course_links`
Vincula produtos a cursos diretamente (independente do nicho).

```sql
CREATE TABLE product_course_links (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  PRIMARY KEY (product_id, course_id)
);
```

### Comportamento na página da aluna
- `?curso=slug` → filtra produtos vinculados a esse curso
- Badge "Filtrando para: [Nome do Curso]" aparece no topo com botão "× Limpar"
- Pílulas de nicho continuam funcionando como sub-filtro dentro do curso
- Sem `?curso`: comportamento normal (filtro só por nicho)

### Admin — ProdutoForm
- Nova seção "Cursos" com checkboxes dos cursos cadastrados
- Admin marca em qual(is) curso(s) o produto é relevante

### Arquivos alterados
| Arquivo | O que muda |
|---------|------------|
| `20260717_supplier_products_course.sql` | Nova migration: tabela + RLS |
| `src/lib/fornecedores/types.ts` | Adiciona `ProductCourseLink` |
| `src/lib/fornecedores/actions.ts` | `getProducts` aceita `courseId`; admin get/upsert inclui cursos |
| `src/components/ferramentas/fornecedores/FornecedoresPage.tsx` | Badge de curso ativo + limpar |
| `src/components/ferramentas/fornecedores/ProdutoForm.tsx` | Seção de cursos com checkboxes |
| `src/app/(student)/ferramentas/fornecedores/page.tsx` | Aceita `?curso=slug`, resolve para id |
| `src/app/(admin)/admin/fornecedores/produtos/novo/page.tsx` | Passa cursos para o form |
| `src/app/(admin)/admin/fornecedores/produtos/[id]/page.tsx` | Passa cursos para o form |

---

## Ordem de implementação

- [x] 1. Migration `20260717_supplier_products.sql` — tabelas base + RLS ✓
- [x] 2. Atualizar `types.ts` — novos tipos ✓
- [x] 3. Atualizar `actions.ts` — novas server actions (student + admin) ✓
- [x] 4. `NichePills.tsx` → substituído por dropdown retrátil em `FornecedoresPage` ✓
- [x] 5. `MaterialCard.tsx` — card com "Comprar agora" + "Visite a loja" + nome da loja ✓
- [x] 6. `FornecedoresPage.tsx` — tabs, filtro nicho dropdown, filtro curso dropdown ✓
- [x] 7. `FornecedorCard.tsx` — canais de canal + lista de produtos vinculados ✓
- [x] 8. `page.tsx` da aluna — nichos, produtos, cursos; aceita `?produto=` do hub ✓
- [x] 9. `AdminProdutosTable.tsx` + `ProdutoForm.tsx` — componentes admin ✓
- [x] 10. Páginas admin `/produtos`, `/produtos/novo`, `/produtos/[id]` ✓
- [x] 11. Atualizar nav admin fornecedores ✓
- [x] 12. Migration `20260717_supplier_products_course.sql` — tabela course links ✓
- [x] 13. Atualizar `types.ts` + `actions.ts` — suporte a curso + channels nos produtos ✓
- [x] 14. `FornecedoresPage.tsx` — badge de curso ativo, dropdown de curso ✓
- [x] 15. `ProdutoForm.tsx` — seção de cursos com checkboxes ✓
- [x] 16. Pages admin novo/editar — passar cursos para o form ✓
- [x] 17. `page.tsx` da aluna — aceitar `?curso=slug` + `?produto=sabonetes/velas` ✓

## Refinamentos pós-v2 (jul/2026)

- [x] Remover campo "Posição" do ProdutoForm — ordenar sempre por nome ✓
- [x] Remover seletor de "Nichos" do ProdutoForm — nicho derivado das tags dos fornecedores vinculados ✓
- [x] `SupplierForm` — seção "Produtos vinculados" acima de Cancelar/Salvar ✓
- [x] `MaterialCard` — substituir tags de nicho por links dos canais do fornecedor ✓
- [x] `MaterialCard` — botões "Comprar agora" + "Visite a loja" removidos; nome da loja vira link direto com ícone ExternalLink ✓
- [x] `FornecedorCard` — exibir produtos vinculados (nome + imagem + link de compra) ✓
- [x] Hub (`FerramentasHub`) — links `?produto=sabonetes/velas` pré-selecionam filtro de nicho ✓
- [x] `ProdutoForm` — campo URL de imagem substituído por upload de arquivo (Supabase Storage `supplier-products`, max 5 MB, jpg/png/webp) ✓
- [x] `FornecedoresPage` — filtros de nicho e curso migrados para `useState` client-side; sem `router.push`; resposta imediata ✓
- [x] `FornecedoresPage` — `useEffect` sincroniza `selectedNiche`/`selectedCourseId` com params de URL para funcionar via SPA navigation ✓
- [x] Filtro de nicho usa `supplier.tags` nos `product_supplier_links`; `product_niche_links` não é utilizado para filtro ✓
- [x] Links de fornecedores em `MaterialCard` ordenados alfabeticamente (`localeCompare('pt-BR')`) ✓
- [x] Push para produção ✓

---

## Decisões técnicas

- **Sem preço**: simplifica manutenção
- **Nicho ≠ curso**: nichos são temáticos (Velas, Sabonetes), não atrelados rigidamente a curso — evita retrabalho quando novos cursos forem lançados
- **Nicho + curso são filtros independentes**: curso filtra "quais produtos são deste curso"; nicho filtra "qual categoria de material". Podem ser combinados.
- **"Ver site oficial"**: prioridade website → shopee → ML → instagram (primeiro canal disponível)
- **RLS**: aluna vê apenas produtos e nichos ativos; admin via service client
- **Upload de foto**: Supabase Storage bucket `supplier-products`, público, 5 MB, jpg/png/webp. Server Action `uploadProductImage` valida MIME e tamanho antes do upload. Campo URL removido do `ProdutoForm`.
- **Filtro de nicho é automático via tags dos fornecedores**: a tabela `product_niche_links` existe mas NÃO é usada para filtro. O nicho de um produto é determinado pelas tags (`supplier_tags`) dos fornecedores vinculados a ele. Para um produto aparecer no filtro "Velas", ao menos um dos seus fornecedores deve ter a tag `velas-artesanais`. Isso elimina manutenção dupla de nichos.
- **Filtros client-side**: todos os produtos são carregados no servidor de uma vez (`getProducts()` sem filtro); os filtros de nicho, curso e busca são `useState` no cliente. Sem `router.push` — resposta imediata, sem round-trip ao servidor.
- **SPA navigation + URL params**: `useEffect` sincroniza `selectedNiche` e `selectedCourseId` com `initialNicheId`/`courseFilter?.id` para que a navegação interna (ex: clique no hub → `?produto=velas`) reflita nos filtros mesmo sem remount do componente.
- **Links de fornecedores em produtos**: ordenados alfabeticamente por `localeCompare('pt-BR')` no `actions.ts` (query-level sort) e como fallback visual.
- **Link na aula**: copiar a URL `/ferramentas/fornecedores?curso=slug` e colar como bloco de link ou HTML na aula
