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

### A2. Reportar Conteúdo (Fila de Moderação)
Alunas não conseguem reportar posts ou comentários inapropriados. A tabela `reports` está prevista no CLAUDE.md mas não existe no banco nem no frontend.

**O que implementar:**
- Migration: tabela `reports (id, reporter_id, target_type, target_id, reason, resolved, created_at)`
- Botão "Reportar" em: posts do fórum, comentários do fórum, posts do feed, comentários do feed
- Fila de moderação no admin: `/admin/comunidade/moderacao` já existe parcialmente — adicionar aba "Reportados"
- Ao resolver: deletar conteúdo + notificar autora (opcional) + registrar em `audit_log`

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

### A8. Performance — Verificar Região Vercel vs Supabase
Se Vercel estiver em `us-east-1` e Supabase também, alunas no Brasil sofrem ~150ms extra por request.

**O que fazer:**
- Vercel Dashboard → Settings → Functions → Region
- Supabase → Settings → General → Region
- Se Vercel não estiver em `gru1` (São Paulo), considerar mover

---

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

### B1. Comentários nas Aulas (Fase 18)
A tabela `lesson_comments (id, lesson_id, user_id, body, created_at)` **já existe no banco** (criada em `002_tables.sql`). Falta toda a UI.

**O que implementar:**
- Seção de comentários abaixo do player/blocos na página de aula (`/aulas/[id]`)
- Listar comentários com avatar, nome, data e texto
- Campo para escrever novo comentário (só alunas matriculadas)
- Admin: ver e deletar comentários no CRUD de aulas
- Notificação (opcional): avisar a professora sobre novo comentário
- RLS: verificar se a policy de `lesson_comments` existe ou precisa ser criada

---

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
| 🔴 1 | A1 — Onboarding |
| 🔴 2 | B2 — Sugestões de cursos |
| 🟠 3 | A2 — Reportar conteúdo |
| 🟠 4 | B1 — Comentários nas aulas (banco pronto) |
| 🟠 5 | A3 — Export CSV métricas |
| 🟡 6 | A4 — Histórico matrículas |
| 🟡 7 | A5 — Perfil público (decidir primeiro) |
| 🟡 8 | A6/A7 — Performance notificações + queries |
| 🟡 9 | A8 — Verificar região Vercel |
| 🟡 10 | A9 — Vitrine hero configurável |
| ⚪ 11 | C1 — Trilhas de aprendizado |
| ⚪ 12 | C2 — Cupons |
| ⚪ 13 | C3 — Bundles |
| ⚪ 14 — | C4 — Desafios mensais |
| ⚪ 15 | C5 — App nativo |
