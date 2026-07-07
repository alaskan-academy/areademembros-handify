# Plano: Tiers de Acesso — Motivação de Compra

**Status:** pendente  
**Objetivo:** Criar diferenciação real entre visitante, cadastrada-sem-compra, aluna e premium para motivar conversões em cada etapa.

---

## Tiers definidos

| Tier | Quem é | Como detectar |
|------|--------|---------------|
| `guest` | Sem conta | Sem sessão |
| `registered` | Tem conta, nunca comprou | `profiles` existe, sem `enrollments` ativos |
| `student` | Comprou ≥1 curso avulso | Tem `enrollments` com `source != 'subscription'` |
| `premium` | Assinatura anual | Tem `enrollments` com `source = 'subscription'` |

Derivado dos dados existentes — **nenhuma coluna nova necessária**.

Helper a criar em `src/lib/access/getUserPlan.ts`:
```ts
export type UserPlan = "guest" | "registered" | "student" | "premium";
export async function getUserPlan(userId: string): Promise<UserPlan>
```

---

## O que fica público (sem conta)

Objetivo: aparecer em posts como ferramenta real, virar CTA para cadastro.

- [ ] **Calculadora de precificação simplificada** (1 produto, sem salvar)
  - Rota: `/ferramentas/calculadora` acessível sem login
  - CTA embaixo: "Salve e compare vários produtos — crie sua conta grátis"
  - `proxy.ts`: adicionar `/ferramentas/calculadora` em `ALWAYS_PUBLIC_PREFIXES`
- [ ] **Tabela de rendimento de matérias-primas** (sabonete, vela, crochê)
  - Página estática ou `static_pages`, sem login
- [ ] **Glossário de artesanato** — traz SEO, completamente estático
- [ ] **Feed de inspirações em modo leitura** (sem curtir/comentar)
  - Mostrar preview dos últimos 6 posts, sem paginação
  - CTA: "Veja tudo e participe — crie sua conta"
- [ ] **Lista de fornecedores sem detalhes** (nome + categoria visíveis, resto bloqueado)
- [ ] `/verificar/[hash]` — já público

---

## O que muda para `registered` (tem conta, não comprou)

Objetivo: sentir que "quase" tem acesso, querer comprar.

- [ ] Calculadora completa (múltiplos produtos) mas **sem salvar histórico**
- [ ] Fornecedores: nome, categoria, cidade — contato/site/avaliações bloqueados com CTA
- [ ] Feed de inspirações completo para leitura — curtir bloqueado com CTA
- [ ] Fórum: vê posts, **não pode comentar** — overlay "adquira um curso para participar"
- [ ] Prévia gratuita de aulas (já existe via `is_preview`)
- [ ] Notificações: recebe push de novos conteúdos (incentivo a voltar)

Implementação: componente `<LockedFeature plan="student" current="registered">` que envolve o conteúdo bloqueado e mostra um overlay/CTA.

---

## O que muda para `student` (comprou ≥1 curso avulso)

Objetivo: comprar mais cursos ou assinar o plano anual.

- [ ] Ferramentas completas com **histórico salvo** (nova tabela `tool_history`)
- [ ] Fornecedores completos: contato, site, avaliações, pode comentar e avaliar
- [ ] Feed de inspirações: curtir, salvar posts, comentar
- [ ] Fórum dos cursos que possui — pode criar posts e comentar
- [ ] Certificados dos cursos concluídos
- [ ] **Histórico de produção** (nova feature): registro de lotes — custo, lucro, data. Cria dependência dos dados ficarem na plataforma.
- [ ] Badge "Aluna" no perfil e nos posts

CTA permanente para upgrade: banner discreto no topo das ferramentas premium bloqueadas — "Desbloqueie com o Plano Anual".

---

## O que é exclusivo para `premium` (assinatura anual)

Objetivo: retenção — ela não pode cancelar porque perde tudo que construiu aqui.

### Ferramentas premium (criam dependência pelos dados)
- [ ] **Planilha de estoque** — matérias-primas e produtos prontos, com alertas de estoque mínimo
- [ ] **Simulador de meta financeira** — "quanto preciso vender para chegar em R$X este mês?"
- [ ] **Calendário de produção** — agenda de lotes, datas de entrega, eventos sazonais (Natal, Dia das Mães)
- [ ] **Calculadora de precificação com categorias salvas** — sabonetes, velas, crochê, cada uma com seus custos padrão já configurados

### Inspirações premium
- [ ] Coleções organizadas por técnica/material
- [ ] Download de receitas e tutoriais em PDF
- [ ] Filtros avançados (por técnica, material, dificuldade)

### Comunidade premium
- [ ] **Fórum geral Premium** — não restrito por curso, todas as premium participam
- [ ] Badge Premium visual nos posts (cor distinta, ícone ✨)

### Acesso e conteúdo
- [ ] Acesso antecipado a cursos novos (7 dias antes do lançamento público)
- [ ] Materiais exclusivos por curso: templates Canva editáveis, checklists, guias de compra de materiais
- [ ] Todos os cursos marcados `is_subscription_only: true`

---

## Componentes e arquitetura

### `LockedFeature` (novo componente)
```tsx
<LockedFeature requiredPlan="student" currentPlan={userPlan}>
  {/* conteúdo bloqueado */}
</LockedFeature>
```
Renderiza o conteúdo com overlay blur + CTA se `currentPlan < requiredPlan`. Ordem: guest < registered < student < premium.

### Middleware (`proxy.ts`)
- Adicionar rotas públicas: `/ferramentas/calculadora`, `/ferramentas/rendimento`, `/ferramentas/glossario`, `/inspiracoes/preview`
- Manter o resto fechado (regra atual de login obrigatório)

### Banco de dados — novas tabelas necessárias
```sql
-- Histórico de produção (student+)
production_records (id, user_id, product_name, batch_size, cost, revenue, date, notes, created_at)

-- Histórico de uso de ferramentas (student+, para salvar)
tool_history (id, user_id, tool_type, data jsonb, created_at)

-- Estoque (premium)
stock_items (id, user_id, name, category, unit, current_qty, min_qty, cost_per_unit, updated_at)

-- Calendário de produção (premium)
production_calendar (id, user_id, title, date, type, notes, created_at)
```

### RLS
- `production_records`, `tool_history`, `stock_items`, `production_calendar`: RLS com `user_id = auth.uid()`
- Nenhuma dessas tabelas tem política de leitura para outros usuários (dados privados)

---

## Ordem de implementação sugerida

1. **Helper `getUserPlan`** + componente `LockedFeature` — base de tudo
2. **Calculadora pública** — impacto imediato em marketing
3. **Bloqueios em ferramentas e fornecedores** para `registered` — converte quem já tem conta
4. **Histórico de produção** para `student` — cria dependência
5. **Ferramentas premium** (planilha de estoque, meta financeira) — retenção
6. **Inspirações e fórum premium**
7. **Acesso antecipado e materiais por curso**

---

## Notas de implementação

- Não criar coluna `plan` em `profiles` — derivar sempre das `enrollments` para evitar inconsistência
- `getUserPlan` deve usar `createServiceClient` (server-side only), nunca exposto ao client
- O client recebe o plano como prop via Server Component — nunca via API pública
- Testar: aluna com enrollment expirado deve ser `registered`, não `student`
