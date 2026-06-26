# Plano de Implementação — Handify Área de Membros

## Fase 0 — Infraestrutura e Setup ✅ CONCLUÍDA

- [x] Criar projeto Next.js 15 com TypeScript strict
- [x] Configurar Tailwind CSS + shadcn/ui
- [x] Configurar `next-pwa` para suporte a PWA (manifest, service worker, ícones)
- [x] Criar projeto no Supabase, configurar `.env.local`
- [x] Aplicar migrations iniciais (todas as tabelas do CLAUDE.md)
- [x] Ativar RLS em todas as tabelas + policies base por role
- [x] Ativar `pgcrypto` no Supabase (para CPF criptografado)
- [x] Ativar `pg_trgm` no Supabase (para busca full-text)
- [x] Configurar Supabase Auth (e-mail/senha apenas)
- [x] Middleware Next.js: proteção de rotas por role
- [x] Deploy inicial na Vercel com env vars configuradas
- [x] Configurar Resend (domínio de envio, API key)

## Fase 1 — Autenticação e Perfil ✅ CONCLUÍDA

- [x] Tela de login (e-mail + senha)
- [x] Tela de cadastro: nome, e-mail, senha
- [x] Recuperação de senha por e-mail (Supabase Auth)
- [x] Trigger Supabase: criar `profile` automaticamente ao criar usuário
- [x] E-mail de boas-vindas via Resend ao criar conta
- [x] Página de perfil: editar foto (Storage), nome, bio
- [x] Preferências de e-mail: opt-out por tipo de notificação
- [x] Proteção de rotas: não logado → redirect para login

## Fase 2 — Catálogo e Player ✅ CONCLUÍDA

- [x] Página home/dashboard: cursos matriculados com progresso + catálogo
- [x] Filtro por categoria
- [x] Página de curso: descrição, módulos colapsáveis, preço, botão comprar → Payt
- [x] Marcação `is_preview` por aula — aulas de prévia acessíveis sem login
- [x] Badge "Prévia grátis" visível nos cards e módulos
- [x] Lógica de acesso: Server Action verifica `enrollment` antes de retornar `video_panda_id`
- [x] Página de aula: player Panda Video + blocos de conteúdo + materiais
- [x] Navegação entre aulas: anterior / próxima dentro do módulo
- [x] Sidebar de módulos com status de conclusão por aula

## Fase 3 — Webhook Payt + Liberação de Acesso ✅ CONCLUÍDA

- [x] Endpoint `POST /api/webhooks/payt` com validação HMAC
- [x] Registrar raw em `payment_events` antes de qualquer processamento
- [x] Buscar curso pelo `product_code` do payload
- [x] Criar `enrollment` após webhook validado (source: 'payt')
- [x] Produto de assinatura: `product_code` → enrollment em todos os cursos `is_subscription_only`
- [x] Webhook de cancelamento/reembolso: revogar enrollment + `audit_log`
- [x] **Aluna ainda não cadastrada:** salvar evento pendente em `payment_events`
- [x] E-mail "Acesso confirmado" com link do curso via Resend
- [ ] Testes unitários: HMAC, mapeamento product_code, duplicata, cancelamento

## Fase 4 — Progresso, Certificado e QR Code ✅ CONCLUÍDA

- [x] Auto-save de `last_position` a cada 10s com debounce (Server Action)
- [x] Auto-mark ao atingir 90% + botão manual "Marcar como concluída"
- [x] Barra de progresso calculada server-side por curso
- [x] Exibir progresso nos cards do dashboard
- [x] Ao concluir 100%: gerar UUID v4 como `verify_hash` + gerar PDF
- [x] PDF do certificado (`pdf-lib`): nome, CPF mascarado, curso, carga horária, data, QR code
- [x] QR code aponta para `{APP_URL}/verificar/{verify_hash}`
- [x] Página pública `/verificar/[hash]`: exibir nome, curso, data — sem CPF
- [x] Upload do PDF para Supabase Storage (bucket privado) + registrar em `certificates`
- [x] Signed URL para download (TTL 60 min)
- [x] E-mail de parabéns com link de download via Resend
- [x] Página "Meus Certificados" no perfil

## Fase 5 — Materiais e Blocos de Conteúdo (Semana 4-5)

- [x] Admin: upload de materiais por aula → Storage (bucket privado)
- [x] Signed URL para download apenas para alunas matriculadas (TTL 3600s — `getMaterialSignedUrl`)
- [x] Listagem de materiais na página da aula
- [x] CRUD de `lesson_content_blocks` no admin (tipo, conteúdo, posição)
- [x] Tipos: `text`, `html`, `embed`, `download`, `video`
- [x] Editor HTML no admin (textarea com código bruto; Tiptap para texto rico)
- [x] Allowlist de domínios para embed: Google Forms, Typeform, Notion, Canva, YouTube
- [x] Sanitização com DOMPurify + allowlist de tags antes de renderizar
- [x] Renderização dos blocos na página de aula

## Fase 6 — Vitrine / Showcase ✅ CONCLUÍDA

- [x] Página `/vitrine` pública (sem login)
- [x] Admin: selecionar cursos para vitrine, ordem, ID do vídeo de vendas Panda
- [x] Cards: thumbnail, título, categoria, carga horária, preço, badge "Prévia grátis"
- [x] Modal ao clicar: player Panda (mini PV) lazy-loaded + descrição + botão "Comprar" → Payt
- [x] SEO: meta tags (open graph, description) para a vitrine

## Fase 7 — Banner Condicional ✅ CONCLUÍDA

- [x] Admin: CRUD de banners (imagem, link, `product_codes[]`, slot, vigência)
- [x] Upload de imagem → Storage
- [x] Server Action: retornar banners filtrados pelos `product_codes` que a aluna não tem
- [x] Visitantes sem login veem todos os banners ativos
- [x] Componentes de banner para slots: header, lateral, pós-aula
- [x] Testes: aluna matriculada não vê banner do seu próprio curso

## Fase 8 — Menu Editável ✅ CONCLUÍDA

- [x] Admin: CRUD de itens de menu (label, URL, ícone, visibilidade, posição, parent_id)
- [x] Reordenação por posição numérica
- [x] Visibilidade: `guest` | `student` | `admin`
- [x] Componente `<StudentNav>` lê config Supabase (sem deploy para alterar)
- [x] Suporte a embed de sites externos via páginas dedicadas (`/biblioteca`, `/calculadora`)

## Fase 9 — Comunidade: Feed de Notícias ✅ CONCLUÍDA

- [x] Seção `/comunidade/feed` — somente admins postam
- [x] Admin: criar/editar/deletar posts (texto + imagem + blocos embed + fixar)
- [x] Alunas: comentar em posts de notícias + curtir
- [x] Disparo de notificação in-app ao publicar novo post
- [x] Posts fixados aparecem no topo

## Fase 10 — Comunidade: Fórum por Curso ✅ CONCLUÍDA

- [x] Seção `/comunidade/forum/[curso]` — alunas matriculadas postam
- [x] Criar post no fórum: título + corpo + imagem + anexo
- [x] Comentários aninhados (1 nível de profundidade)
- [x] Curtir posts (tabela polimórfica `post_likes`)
- [x] Admin: fixar posts, responder com badge "Equipe Handify", moderação
- [x] Reportar post/comentário → fila de moderação
- [x] Sanitização de todos os inputs (Zod + DOMPurify)
- [x] Admin: fórum por categoria, fóruns CRUD (`/admin/forums`)

## Fase 11 — Notificações e E-mails ✅ CONCLUÍDA

- [x] Tabela `notifications` com realtime subscription
- [x] Eventos que criam notificação: novo post no feed, campanhas admin
- [x] Componente sino no header com badge de não lidas (realtime)
- [x] Painel `/notificacoes`: lista, timestamp, link, "marcar todas como lidas"
- [x] E-mail lembrete de reengajamento via `/api/cron/reengagement` (Vercel Cron)
- [x] Templates Resend com identidade visual Handify
- [x] Admin: campanhas de notificação (`/admin/notificacoes`)

## Fase 11b — Notificações Push (Web Push API) ✅ TESTADO EM PRODUÇÃO

- [x] Solicitar permissão de notificação push ao usuário (PushPromptBanner — 15 dias, inteligente)
- [x] Registrar service worker com suporte a push (`worker/index.ts` + `customWorkerSrc`)
- [x] Salvar `PushSubscription` no banco (`push_subscriptions`: `user_id`, `endpoint`, `p256dh`, `auth`) + RLS
- [x] Server Action para enviar push via Web Push API (`web-push`, `broadcastPush`, `sendPushToUser`)
- [x] Eventos que disparam push: `dispatchCampaign` dispara push após inserir notificações in-app
- [x] Admin: notificações/campanhas existentes já disparam push (integrado em `dispatchCampaign`)
- [x] Aluna: botão "Ativar/Desativar" no perfil (`PushSubscribeButton`)
- [x] Graceful degradation: `PushPromptBanner` e `PushSubscribeButton` retornam null se push não suportado
- [x] Admin métricas: card "Push ativas" mostra quantidade de alunas com push ativo
- [x] Admin aluna: campo Push Ativa/Inativa nos dados cadastrais de cada aluna
- [x] Smart prompt: 1x para quem aprovou (só repete em novo dispositivo); a cada 15 dias para quem não ativou — cooldown respeitado mesmo quando permission="granted" mas subscription falhou
- [x] VAPID keys geradas e configuradas (`.env.local` + Vercel) — chave pública deve ser URL-safe base64 SEM `=`
- [x] Migration SQL rodada no Supabase (`supabase/migrations/20260625_push_subscriptions.sql`)
- [x] **Testado e funcionando em produção** — subscription salva no banco, admin mostra "Ativa" (jun/2026)

## Fase 12 — Busca Global ✅ CONCLUÍDA

- [x] Server Action de busca usando `pg_trgm` (cursos + aulas + posts do feed)
- [x] Resultados agrupados por tipo (curso, aula, notícia)
- [x] Componente `<GlobalSearch>` com `Ctrl+K` / `⌘K` integrado no header
- [x] Highlight do termo buscado nos resultados

## Fase 13 — Painel Admin Completo ✅ CONCLUÍDA

- [x] Guard de role `admin` no middleware (dupla verificação middleware + Server Action)
- [x] CRUD de cursos com todos os campos (`product_code`, `workload_hours`, etc.)
- [x] CRUD de módulos e aulas com blocos de conteúdo e materiais
- [x] Gestão de vitrine (showcase) e banners
- [x] Gestão de menu e páginas estáticas (`/admin/paginas/` CRUD + `/p/[slug]` rota pública)
- [x] Gestão do feed de notícias (`/admin/comunidade/feed`)
- [x] Listagem de alunas: busca, progresso, dar/revogar acesso + `audit_log`
- [x] Exportar alunas CSV (`/api/admin/alunos/export`)
- [x] Dashboard de métricas: matrículas, taxa de conclusão, certificados, webhooks recentes, push ativas
- [x] Fila de moderação: reportados → deletar/banir + `audit_log` (`/admin/comunidade/forum`)
- [x] Admin: e-mails transacionais (`/admin/emails`)
- [x] Admin: campanhas/notificações (`/admin/notificacoes`)
- [x] Admin: plano anual (`/admin/plano-anual`)

## Fase 14 — PWA e Polimento (Semana 9)

- [x] `next-pwa` (`@ducanh2912/next-pwa`): manifest.json, service worker (`sw.js`), ícones 192×192 e 512×512
- [x] Splash screen: controlada por `background_color`/`theme_color` no manifest (sem arquivo separado)
- [x] Offline fallback: `src/app/~offline/page.tsx` com identidade visual Handify completa
- [x] Teste "Adicionar à tela inicial" em Android e iOS (confirmado pela Jessica)

## Fase 15 — Testes, Segurança e Launch

- [ ] Testes E2E (Playwright): auth → compra via webhook → aula → certificado → verificação
- [ ] Revisão de RLS: testar cada policy com usuários de roles diferentes
- [x] Revisão de segurança: HMAC webhook, signed URLs, sanitização HTML, headers CSP
- [ ] Acessibilidade: contraste WCAG AA, foco visível, aria-labels, alt texts (revisão completa)
- [x] Mobile: fluxos completos em 375px e 430px (Fase 16)
- [ ] Performance: bundle analysis, lazy load player confirmado
- [ ] Domínio customizado na Vercel (ex: `membros.handify.com.br`)
- [x] Seed de dados de demo: `supabase/seed_demo.sql`

## Fase 16 — Responsividade Mobile e Revisão de UX/UI ✅ CONCLUÍDA

- [x] Layouts em 375px–430px: sidebar, cards, grids, formulários
- [x] Touch targets WCAG 44×44px: botões, links de aula, filtros, textareas
- [x] `NotificationBell` dropdown sem overflow em 375px
- [x] Drawer mobile (`student-nav`) com largura `min(18rem, 85vw)`
- [x] Overflow horizontal corrigido: `overflow-x-hidden` nos layouts, `min-w-0` nos containers
- [x] `ScrollToTop` — sobe ao topo em cada navegação (mobile e desktop)
- [x] Tabs de métricas scrolláveis horizontalmente em telas pequenas

## 🧹 Limpeza de Git — Fazer ao Final do Projeto

- [ ] **Revisar arquivos pessoais rastreados** — o `.git` está na raiz da home (`C:\Users\Jessica Veiga`), então arquivos pessoais da pasta home aparecem como "untracked" no `git status`. Ao finalizar o projeto, revisar e adicionar ao `.gitignore` raiz (ou mover o repositório para ter raiz em `Área de Membros`).
- [ ] **Arquivos a ignorar ou remover do tracking:** `.claude/`, `AppData/`, `Documents/`, `Desktop/` (outros projetos), `package-lock.json` da home, `NTUSER.DAT*`, etc.

## ⚠️ Lembretes de Launch — NÃO ESQUECER

- [x] **`CERTIFICATE_ENCRYPTION_KEY`** — configurada nas env vars da Vercel ✅ (confirmado jun/2026)
- [x] **Domínio customizado** — `membros.handify.com.br` configurado na Vercel ✅ (confirmado jun/2026)
- [ ] **Botão de acesso no site externo** — ao finalizar a plataforma, adicionar botão "Acessar Área de Membros" no site principal da Handify apontando para a URL da plataforma

## Fase 17 — Checagem de Segurança e Organização de Backend (Pré-launch)

### Segurança
- [ ] **RLS — revisão completa:** confirmar que todas as tabelas têm RLS ativo e policies cobrindo todos os cenários (student lê só o próprio, admin lê tudo, sem acesso anônimo a dados sensíveis)
- [ ] **Server Actions:** garantir que todas as mutações verificam role (`assertAdmin` / `assertStudent`) antes de qualquer operação
- [ ] **Webhook Payt:** testar HMAC com payload inválido (deve retornar 401), payload duplicado (idempotência), produto inexistente
- [ ] **Vídeo Panda:** confirmar que `video_panda_id` nunca chega ao client sem matrícula verificada — auditar todos os Server Actions de aula
- [x] **Storage privado:** signed URLs confirmadas — materiais e certificados usam `createSignedUrl` TTL 3600s; nenhum arquivo acessível por URL direta
- [ ] **CPF:** verificar que nunca é logado, nunca aparece em resposta JSON, nunca é exposto no client — apenas no PDF do certificado
- [ ] **Rate limiting:** revisar se `/api/webhooks/payt` e rotas de auth têm proteção contra abuso
- [ ] **Sanitização HTML:** confirmar que todos os blocos de conteúdo `html`/`embed` passam por DOMPurify antes de renderizar
- [ ] **Env vars:** confirmar que nenhum segredo está hardcoded — rodar `grep` por API keys e tokens no código
- [ ] **HTTPS / headers de segurança:** verificar `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` no `next.config.ts`

### Organização de Backend
- [ ] **Supabase:** revisar índices nas tabelas com mais queries (`enrollments.user_id`, `lesson_progress.user_id+lesson_id`, `payment_events.buyer_email`)
- [ ] **Queries N+1:** auditar Server Components que fazem queries dentro de loops — consolidar em joins ou `Promise.all`
- [ ] **`payment_events` pendentes:** implementar reprocessamento automático ao criar perfil com mesmo e-mail (trigger ou cron)
- [ ] **Audit log:** confirmar que todas as ações admin críticas (dar/revogar acesso, banir aluna, deletar conteúdo) estão sendo registradas em `audit_log`
- [ ] **Edge cases do webhook:** testar cancelamento/reembolso — enrollment revogado corretamente, `audit_log` registrado
- [ ] **Variáveis de ambiente:** confirmar que todas as env vars estão preenchidas na Vercel (incluindo `CERTIFICATE_ENCRYPTION_KEY`)
- [ ] **Logs e monitoramento:** revisar se erros críticos (falha de webhook, falha de geração de certificado) são logados adequadamente
- [ ] **Backup e retenção:** verificar configuração de backup automático do Supabase (habilitado no plano?)

## Fase 18 — Comentários nas Aulas

- [ ] **Tabela `lesson_comments`:** `id`, `lesson_id`, `user_id`, `body`, `parent_id` (1 nível de resposta), `created_at`, `deleted_at` (soft delete)
- [ ] **RLS:** aluna lê comentários de aulas do curso matriculado; admin lê tudo; criação apenas para alunas matriculadas
- [ ] **Componente de comentários na página de aula:** lista paginada (mais antigos → mais novos), formulário de texto ao final
- [ ] **Responder comentário:** campo inline abaixo do comentário original (1 nível)
- [ ] **Curtir comentário:** tabela `post_likes` polimórfica (target_type = 'lesson_comment')
- [ ] **Moderação admin:**
  - Fila de comentários reportados (`reports` com `target_type = 'lesson_comment'`)
  - Admin pode deletar comentário (soft delete) + notificar autora (opcional)
  - Painel `/admin/comunidade/forum` já existente — adicionar aba "Comentários de Aulas"
- [ ] **Notificação:** resposta ao comentário da aluna → notificação in-app + e-mail (opt-out)
- [ ] **Sanitização:** Zod para validar body (max 2000 chars) + DOMPurify para render
- [ ] **Exibição:** mostrar avatar/inicial + nome + data + corpo; comentários deletados mostram "[comentário removido]"

## Fase 19 — App Nativo (Apple App Store + Google Play)

> **Pré-requisito:** PWA já configurado (`next-pwa`). Avaliar se PWA é suficiente antes de partir para app nativo.

### Opção A — PWA aprimorado (caminho mais rápido)
- [ ] Verificar suporte PWA no iOS Safari (ícone, splash, standalone)
- [ ] Testar instalação "Adicionar à tela inicial" no Android e iOS
- [ ] Push notifications via Web Push API (Fase 11b já planejada)
- [ ] **Limitação:** não aparece nas lojas; experiência nativa limitada no iOS

### Opção B — App nativo com React Native / Expo (caminho completo)
- [ ] Criar projeto Expo com `expo-router` (roteamento similar ao Next.js)
- [ ] Reutilizar lógica de negócio e chamadas Supabase do web
- [ ] Player Panda Video via `expo-web-browser` ou WebView com SDK Panda
- [ ] Autenticação: Supabase Auth com `expo-secure-store` para tokens
- [ ] Push notifications: `expo-notifications` + Expo Push Service
- [ ] Build e distribuição: EAS Build (Expo Application Services)
- [ ] **Apple App Store:** conta Apple Developer ($99/ano), review ~1-3 dias
- [ ] **Google Play:** conta Google Play Developer ($25 único), review ~3-7 dias
- [ ] **In-app purchase:** se necessário, integrar com Apple/Google IAP (além do Payt)

### Decisão pendente
- [ ] Definir se o app nativo é prioridade ou se o PWA resolve o caso de uso
- [ ] Avaliar custo/benefício: Expo Managed vs Bare Workflow

## Decisões Pendentes

- [ ] Domínio da plataforma (ex: `membros.handify.com.br`)
- [ ] Qual plano Panda Video (verificar limites de armazenamento/bandwidth)
- [ ] Frequência do cron de reengajamento (sugestão: rodar diariamente às 10h)

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Webhook Payt chega antes do cadastro da aluna | Salvar `payment_events` pendente; trigger reprocessa ao criar perfil com mesmo e-mail |
| `product_code` duplicado no admin | Unique constraint no banco + validação ao salvar curso |
| Vídeo Panda acessível sem matrícula | ID nunca no client; Server Action verifica enrollment antes de retornar |
| CPF exposto em logs ou respostas JSON | Criptografado no banco; nunca serializado; só no PDF do certificado |
| Hash de certificado enumerável | UUID v4 — não sequencial, não adivinhável |
| HTML malicioso em blocos de conteúdo | DOMPurify + allowlist de tags; embeds só de domínios allowlistados |
| Spam no fórum | Rate limit por user, sistema de denúncia, fila de moderação |
| E-mails em spam | Domínio verificado no Resend + SPF/DKIM configurados |
| Reengajamento excessivo (unsubscribe) | Preferências de e-mail por tipo no perfil; link de descadastro em todos os e-mails |
