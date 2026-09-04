# Plano: Próximas Fases — Tudo que falta trabalhar

Compilado em 04/07/2026. Verificado diretamente no codebase.
Planos com arquivo próprio: [Onboarding](onboarding-primeiro-acesso.md) | [Métricas de Engajamento](swift-imagining-lagoon.md) (já implementado).

---

## FASE A — Gaps da plataforma atual (coisas que faltam)

### A1. Onboarding — Tutorial de Primeiro Acesso
**→ Ver plano detalhado em `onboarding-primeiro-acesso.md`**

Resumo: modal de boas-vindas no primeiro login + checklist de primeiros passos no dashboard. Nenhuma linha de código escrita ainda.
- Migration: `onboarding_dismissed_at` + `onboarding_steps` em `profiles`
- `OnboardingModal.tsx` + `OnboardingChecklist.tsx`
- Server Actions de onboarding
- Integração no dashboard
- **Jessica grava:** vídeo de orientação da plataforma (3–5 min) como aula com `is_preview: true`

---

### A3. Export CSV nas Métricas Admin
O dashboard de métricas tem cards e ranking mas sem botão de exportar. Existe apenas o export de alunas (`/api/admin/alunos/export`).

**O que implementar:**
- Rota `/api/admin/metricas/export` com filtro de período (7d / 30d / tudo)
- Colunas: aluna, email, score de engajamento, posts, comentários, aulas concluídas, certificados, última atividade
- Botão "Exportar CSV" na página `/admin/metricas/engajamento`

---

### A4. Histórico Completo de Matrículas
No perfil da aluna aparece só matrículas **ativas**. Matrículas expiradas ou revogadas desaparecem sem registro visível para a aluna.

**O que implementar:**
- Na seção "Meus Cursos" do perfil: adicionar aba ou seção "Histórico" mostrando matrículas encerradas com data e motivo (quando disponível via `audit_log`)
- No admin (detalhe da aluna): mostrar matrículas revogadas com motivo registrado

---

### A5. Perfil Público da Aluna
**⚠️ Decisão pendente:** A plataforma está 100% fechada (exige login em tudo). O CLAUDE.md prevê `/perfil/[id]` público com bio, foto e projetos do fórum.

**Opções:**
- **Manter privado:** perfil só visível para a própria aluna e admin (situação atual) — mais simples, sem mudança de política
- **Abrir parcialmente:** rota `/perfil/[id]` acessível apenas para outras alunas logadas (não público para internet)
- **Abrir totalmente:** rota pública sem login — requer revisão da política de segurança

Quando decidir a opção, retomar a implementação.

---

### A6. Performance — Notificações no Layout
`getNotifications()` e `getUnreadCount()` rodam server-side em **toda** navegação (cada clique de menu).

**O que implementar:**
- Remover as 2 queries do `StudentLayout` (`src/app/(student)/layout.tsx`)
- `StudentHeader` passa a buscar via client-side fetch com `useEffect` após render
- Criar Server Action ou rota `/api/notifications` para o fetch do cliente
- Risco baixo: flash de ~200ms de 0 → número real no badge do sino

---

### A7. Performance — 2º Round de Queries em /aulas
Em `src/app/(student)/aulas/[id]/page.tsx` há dois `Promise.all` encadeados: Round 1 busca lesson + user, Round 2 (dependente do Round 1) busca progress + modules.

**O que implementar:**
- Ajustar o `.select()` da primeira query para trazer `course_id` junto com `lesson`
- Eliminar o segundo round, tornando tudo um único `Promise.all`
- Testar: aulas preview, aulas pagas e acesso negado

---

### A8. Performance — Região Vercel vs Supabase ✅ RESOLVIDO em 04/09/2026

**Era a causa principal da lentidão.** O Supabase está em `sa-east-1` (São Paulo)
e as funções da Vercel rodavam em `iad1` (Washington). O cabeçalho
`X-Vercel-Id: gru1::iad1` provava o caminho: a aluna entrava pelo edge de São
Paulo, a função executava nos Estados Unidos e o banco respondia de volta em São
Paulo. **Cada consulta atravessava o Atlântico duas vezes.**

Correção: `"regions": ["gru1"]` no `vercel.json` (commit `a65d75b`).

Medido em produção, rota que faz uma consulta ao banco:

| | Antes (iad1) | Depois (gru1) |
|---|---|---|
| TTFB, medidas quentes | 0,56 – 0,77 s | 0,156 – 0,285 s |
| Mediana | ~0,61 s | **0,167 s** |

**3,6× mais rápido**, e o ganho multiplica nas telas que fazem várias consultas
em série. A página de aula, por exemplo, faz 4 rodadas sequenciais.

### A9. Vitrine Hero Hardcoded
Textos em `src/app/(student)/cursos/page.tsx` (linhas ~259-268) estão fixos no código:
- "Plataforma de Cursos de Artesanato"
- "Aprenda o que suas mãos podem criar"
- "Um espaço feito para aprender e criar."

**O que implementar:**
- Ler esses textos da tabela `static_pages` (slug `vitrine-hero`) ou criar uma tabela `site_config` simples
- Admin consegue editar sem deploy

---

## FASE B — Novas funcionalidades

### B2. Sugestões de Cursos durante/após Aula
Estilo Hotmart — ao concluir uma aula (ou ao atingir 90% do progresso), sugerir cursos relacionados que a aluna ainda não tem matrícula.

**Como funciona:**
- Critério de sugestão: mesma categoria do curso em andamento + cursos mais matriculados
- Momento de exibição: modal/card ao marcar aula concluída OU ao concluir o curso inteiro
- Sugestões aleatórias dentro do critério (evitar sempre mostrar o mesmo)
- Só mostrar cursos que a aluna **não** tem matrícula ainda
- Link para a vitrine ou para o checkout Payt do curso sugerido

**Onde implementar:**
- `src/app/(student)/aulas/[id]/` — ao marcar aula concluída
- Componente `SugestoesCursos.tsx` com 2–3 cards de curso
- Query: `courses WHERE category_id = $cat AND id NOT IN (enrollments de user_id) ORDER BY random() LIMIT 3`

---

## FASE C — Roadmap futuro (longo prazo)

### C1. Trilhas de Aprendizado
Sequência curada de cursos com ordem definida pelo admin. Aluna vê seu progresso na trilha (ex: "Trilha Artesã Completa: 3 de 5 cursos concluídos").

**Requer:** tabela `learning_paths`, `learning_path_courses` (ordem), UI de trilha no dashboard e na vitrine.

---

### C2. Cupons de Desconto Rastreáveis
Códigos de desconto para campanhas (influenciadoras, datas especiais). Integração com o checkout Payt.

**Requer:** tabela `coupons (code, discount_pct, max_uses, used_count, expires_at)`, lógica no webhook Payt para registrar cupom usado, relatório de uso no admin.

---

### C3. Pacotes/Bundles de Cursos
Vender grupos de cursos com um único `product_code` Payt. Um bundle libera múltiplos `enrollments`.

**Requer:** tabela `bundles`, lógica no webhook para liberar vários cursos de uma vez.

---

### C4. Desafios Mensais da Comunidade
Admin cria um desafio mensal (ex: "Faça uma vela aromática em julho"). Alunas postam no fórum com tag do desafio. Admin seleciona destaques.

**Requer:** tabela `challenges`, campo `challenge_id` em `forum_posts`, página de desafio ativo, integração com Inspirações.

---

### C5. Aplicativo Nativo (Google Play / App Store)
App mobile com React Native / Expo. Consumiria a mesma API Supabase e player Panda Video.

**Requer:** projeto React Native separado, autenticação Supabase no mobile, player Panda Video mobile, notificações push nativas (Firebase FCM), submissão nas lojas.

**Pré-requisito:** plataforma web 100% estável e com boa base de alunas ativas.

---

## Ordem de prioridade sugerida

| Prioridade | Item |
|-----------|------|
| 🔴 1 | ~~A1 — Onboarding~~ ✅ |
| 🔴 2 | B2 — Sugestões de cursos |
| 🟠 3 | A3 — Export CSV métricas |
| 🟡 4 | A4 — Histórico matrículas |
| 🟡 5 | A5 — Perfil público (decidir primeiro) |
| 🟡 6 | A6/A7 — Performance notificações + queries |
| 🟡 7 | A8 — Verificar região Vercel |
| 🟡 8 | A9 — Vitrine hero configurável |
| ⚪ 9 | C1 — Trilhas de aprendizado |
| ⚪ 10 | C2 — Cupons |
| ⚪ 11 | C3 — Bundles |
| ⚪ 12 | C4 — Desafios mensais |
| ⚪ 13 | C5 — App nativo |
