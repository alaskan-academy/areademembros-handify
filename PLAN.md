# Plano de Implementação — Handify Área de Membros

## Fase 0 — Infraestrutura e Setup (Semana 1)

- [ ] Criar projeto Next.js 15 com TypeScript strict
- [ ] Configurar Tailwind CSS + shadcn/ui
- [ ] Configurar `next-pwa` para suporte a PWA (manifest, service worker, ícones)
- [ ] Criar projeto no Supabase, configurar `.env.local`
- [ ] Aplicar migrations iniciais (todas as tabelas do CLAUDE.md)
- [ ] Ativar RLS em todas as tabelas + policies base por role
- [ ] Ativar `pgcrypto` no Supabase (para CPF criptografado)
- [ ] Ativar `pg_trgm` no Supabase (para busca full-text)
- [ ] Configurar Supabase Auth (e-mail/senha apenas)
- [ ] Middleware Next.js: proteção de rotas por role
- [ ] Deploy inicial na Vercel com env vars configuradas
- [ ] Configurar Resend (domínio de envio, API key)

## Fase 1 — Autenticação e Perfil (Semana 1-2)

- [ ] Tela de login (e-mail + senha)
- [ ] Tela de cadastro: nome, e-mail, senha
- [ ] Recuperação de senha por e-mail (Supabase Auth)
- [ ] Trigger Supabase: criar `profile` automaticamente ao criar usuário
- [ ] E-mail de boas-vindas via Resend ao criar conta
- [ ] Página de perfil: editar foto (Storage), nome, bio
- [ ] Preferências de e-mail: opt-out por tipo de notificação
- [ ] Proteção de rotas: não logado → redirect para login

## Fase 2 — Catálogo e Player (Semana 2-3)

- [ ] Página home/dashboard: cursos matriculados com progresso + catálogo
- [ ] Filtro por categoria
- [ ] Página de curso: descrição, módulos colapsáveis, preço, botão comprar → Payt
- [ ] Marcação `is_preview` por aula — aulas de prévia acessíveis sem login
- [ ] Badge "Prévia grátis" visível nos cards e módulos
- [ ] Lógica de acesso: Server Action verifica `enrollment` antes de retornar `video_panda_id`
- [ ] Página de aula: player Panda Video + blocos de conteúdo + materiais
- [ ] Navegação entre aulas: anterior / próxima dentro do módulo
- [ ] Sidebar de módulos com status de conclusão por aula

## Fase 3 — Webhook Payt + Liberação de Acesso (Semana 3)

- [ ] Endpoint `POST /api/webhooks/payt` com validação HMAC
- [ ] Registrar raw em `payment_events` antes de qualquer processamento
- [ ] Buscar curso pelo `product_code` do payload
- [ ] Criar `enrollment` após webhook validado (source: 'payt')
- [ ] Produto de assinatura: `product_code` → enrollment em todos os cursos `is_subscription_only`
- [ ] Webhook de cancelamento/reembolso: revogar enrollment + `audit_log`
- [ ] **Aluna ainda não cadastrada:** salvar evento pendente em `payment_events`; trigger reprocessa ao criar perfil com mesmo e-mail
- [ ] E-mail "Acesso confirmado" com link do curso via Resend
- [ ] Testes unitários: HMAC, mapeamento product_code, duplicata, cancelamento

## Fase 4 — Progresso, Certificado e QR Code (Semana 4)

- [ ] Auto-save de `last_position` a cada 10s com debounce (Server Action)
- [ ] Auto-mark ao atingir 90% + botão manual "Marcar como concluída"
- [ ] Barra de progresso calculada server-side por curso
- [ ] Exibir progresso nos cards do dashboard
- [ ] Ao concluir 100%: gerar UUID v4 como `verify_hash` + gerar PDF
- [ ] PDF do certificado (`pdf-lib`): nome, CPF (sem criptografia no PDF, exibir mascarado), curso, carga horária, data, QR code
- [ ] QR code aponta para `{APP_URL}/verificar/{verify_hash}`
- [ ] Página pública `/verificar/[hash]`: exibir nome, curso, data — sem CPF
- [ ] Upload do PDF para Supabase Storage (bucket privado) + registrar em `certificates`
- [ ] Signed URL para download (TTL 60 min)
- [ ] E-mail de parabéns com link de download via Resend
- [ ] Página "Meus Certificados" no perfil

## Fase 5 — Materiais e Blocos de Conteúdo (Semana 4-5)

- [ ] Admin: upload de materiais por aula → Storage (bucket privado)
- [ ] Signed URL para download apenas para alunas matriculadas
- [ ] Listagem de materiais na página da aula
- [ ] CRUD de `lesson_content_blocks` no admin (tipo, conteúdo, posição)
- [ ] Tipos: `text`, `html`, `embed`, `download`
- [ ] Editor HTML no admin (Monaco Editor ou textarea expandida)
- [ ] Allowlist de domínios para embed: Google Forms, Typeform, Notion, Canva, YouTube
- [ ] Sanitização com DOMPurify + allowlist de tags antes de renderizar
- [ ] Renderização dos blocos na página de aula

## Fase 6 — Vitrine / Showcase (Semana 5)

- [ ] Página `/vitrine` pública (sem login)
- [ ] Admin: selecionar cursos para vitrine, ordem, ID do vídeo de vendas Panda
- [ ] Cards: thumbnail, título, categoria, carga horária, preço, badge "Prévia grátis"
- [ ] Modal ao clicar: player Panda (mini PV) lazy-loaded + descrição + botão "Comprar" → Payt
- [ ] SEO: meta tags (open graph, description) para a vitrine

## Fase 7 — Banner Condicional (Semana 5)

- [ ] Admin: CRUD de banners (imagem, link, `product_codes[]`, slot, vigência)
- [ ] Upload de imagem → Storage
- [ ] Server Action: retornar banners filtrados pelos `product_codes` que a aluna não tem
- [ ] Visitantes sem login veem todos os banners ativos
- [ ] Componentes de banner para slots: header, lateral, pós-aula
- [ ] Testes: aluna matriculada não vê banner do seu próprio curso

## Fase 8 — Menu Editável (Semana 6)

- [ ] Admin: CRUD de itens de menu (label, URL, ícone, visibilidade, posição, parent_id)
- [ ] Reordenação por posição numérica
- [ ] Suporte a sub-menus de 1 nível
- [ ] Componente `<NavMenu>` lê config Supabase com cache Next.js
- [ ] Revalidação de cache ao salvar alterações
- [ ] Visibilidade: `guest` | `student` | `admin`

## Fase 9 — Comunidade: Feed de Notícias (Semana 6-7)

- [ ] Seção `/comunidade/feed` — somente admins postam
- [ ] Admin: criar/editar/deletar posts (texto + imagem + blocos embed + fixar)
- [ ] Post tipo "Aluna em Destaque": campo para link de perfil + texto de destaque
- [ ] Alunas: comentar em posts de notícias + curtir
- [ ] Disparo de notificação in-app + e-mail (opt-out) ao publicar novo post
- [ ] Posts fixados aparecem no topo
- [ ] Busca de posts pelo sistema global

## Fase 10 — Comunidade: Fórum por Curso (Semana 7)

- [ ] Seção `/comunidade/forum/[curso]` — alunas matriculadas postam
- [ ] Criar post no fórum: título + corpo + imagem
- [ ] Comentários aninhados (1 nível de profundidade)
- [ ] Curtir posts e comentários (tabela polimórfica `post_likes`)
- [ ] Admin/professora: fixar posts, responder com badge especial
- [ ] Reportar post/comentário
- [ ] Sanitização de todos os inputs (Zod + DOMPurify)
- [ ] Perfil público da aluna: posts, projetos, cursos

## Fase 11 — Notificações e E-mails (Semana 7-8)

- [ ] Tabela `notifications` com trigger Supabase para inserção
- [ ] Eventos que criam notificação: novo post no feed, resposta ao seu comentário, novo conteúdo no curso, conclusão de curso, certificado disponível
- [ ] Componente sino no header com badge de não lidas (realtime via Supabase subscription)
- [ ] Painel `/notificacoes`: lista, timestamp, link, "marcar todas como lidas"
- [ ] E-mail lembrete de reengajamento: 7 dias sem acessar curso em andamento (Edge Function com cron Supabase ou Vercel Cron)
- [ ] Templates Resend com identidade visual Handify

## Fase 11b — Notificações Push (Web Push API)

- [ ] Solicitar permissão de notificação push ao usuário (prompt contextual, não na entrada)
- [ ] Registrar service worker com suporte a push (`next-pwa` já configurado)
- [ ] Salvar `PushSubscription` do usuário no banco (`push_subscriptions` table) com `user_id`, `endpoint`, `keys`)
- [ ] Edge Function / Server Action para enviar push via Web Push API (biblioteca `web-push`)
- [ ] Eventos que disparam push (mesmos das notificações in-app): novo post no feed, resposta ao comentário, novo conteúdo no curso, certificado disponível
- [ ] Admin: painel para testar envio de push broadcast para todas as alunas
- [ ] Admin: enable/disable notificações push globalmente
- [ ] Aluna: botão "Ativar notificações" nas preferências do perfil (e opção de revogar)
- [ ] Graceful degradation: se push não for suportado/negado, apenas silencia (não quebra nada)

## Fase 12 — Busca Global (Semana 8)

- [ ] Endpoint/Server Action de busca usando `pg_trgm` (cursos + aulas + posts do feed)
- [ ] Resultados agrupados por tipo (curso, aula, notícia)
- [ ] Componente de busca com `Ctrl+K` / `⌘K` (Command Palette)
- [ ] Highlight do termo buscado nos resultados

## Fase 13 — Painel Admin Completo (Semana 8-9)

- [ ] Guard de role `admin` no middleware (dupla verificação middleware + Server Action)
- [ ] CRUD de categorias
- [ ] CRUD de cursos com todos os campos (`product_code`, `workload_hours`, `is_subscription_only`)
- [ ] CRUD de módulos e aulas com blocos de conteúdo e materiais
- [ ] Gestão de vitrine (showcase) e banners
- [ ] Gestão de menu e páginas estáticas
- [ ] Gestão do feed de notícias
- [ ] Listagem de alunas: busca, progresso, dar/revogar acesso + `audit_log`, exportar CSV
- [ ] Dashboard de métricas: matrículas, taxa de conclusão, certificados, webhooks recentes
- [ ] Exportar relatórios CSV (alunas por curso, certificados emitidos)
- [ ] Fila de moderação: reportados → deletar/banir + `audit_log`

## Fase 14 — PWA e Polimento (Semana 9)

- [ ] `next-pwa`: manifest.json, service worker, ícones Handify em múltiplos tamanhos
- [ ] Splash screen com logo Handify
- [ ] Offline fallback: página simples quando sem conexão
- [ ] Teste "Adicionar à tela inicial" em Android e iOS

## Fase 15 — Testes, Segurança e Launch (Semana 9-10)

- [ ] Testes E2E (Playwright): auth → compra via webhook → aula → certificado → verificação
- [ ] Revisão de RLS: testar cada policy com usuários de roles diferentes
- [ ] Revisão de segurança: HMAC webhook, signed URLs, rate limit, sanitização HTML
- [ ] Acessibilidade: contraste WCAG AA, foco visível, aria-labels, alt texts
- [ ] Mobile: fluxos completos em 375px e 430px
- [ ] Performance: `next/image`, lazy load player, bundle analysis
- [ ] Domínio customizado na Vercel (ex: `membros.handify.com.br`)
- [ ] Seed de dados de demo: cursos, alunas, posts, certificados

## Fase 16 — Responsividade Mobile e Revisão de UX/UI (Pré-launch)

- [ ] **Responsividade completa:** testar e ajustar todos os layouts em 375px, 390px e 430px (iPhone SE, iPhone 14, iPhone 14 Plus)
- [ ] **Admin mobile:** verificar se as telas de gestão são usáveis em telas pequenas (pelo menos leitura)
- [ ] **Player em mobile:** controles de vídeo acessíveis, sidebar de módulos colapsável
- [ ] **Cards e grids:** garantir que todos os grids responsivos quebram corretamente (1 coluna em mobile)
- [ ] **Formulários:** inputs com tamanho mínimo de toque (44×44px), labels visíveis, teclado não sobrepõe campos
- [ ] **Header e navegação:** menu mobile acessível (hamburger ou bottom nav)
- [ ] **Revisão de UX — fluxo completo da aluna:** cadastro → compra → acesso → aula → certificado
- [ ] **Revisão de UI — consistência visual:** espaçamentos, tipografia, cores, bordas e sombras padronizados em todas as páginas
- [ ] **Estados de loading e erro:** skeleton loaders, mensagens de erro amigáveis, estados vazios com call-to-action
- [ ] **Micro-interações:** hover, foco, transições de botões e links (`250ms ease-out`)
- [ ] **Acessibilidade:** aria-labels em ícones, foco visível em todos os interativos, alt text em imagens

## 🧹 Limpeza de Git — Fazer ao Final do Projeto

- [ ] **Revisar arquivos pessoais rastreados** — o `.git` está na raiz da home (`C:\Users\Jessica Veiga`), então arquivos pessoais da pasta home aparecem como "untracked" no `git status`. Ao finalizar o projeto, revisar e adicionar ao `.gitignore` raiz (ou mover o repositório para ter raiz em `Área de Membros`).
- [ ] **Arquivos a ignorar ou remover do tracking:** `.claude/`, `AppData/`, `Documents/`, `Desktop/` (outros projetos), `package-lock.json` da home, `NTUSER.DAT*`, etc.

## ⚠️ Lembretes de Launch — NÃO ESQUECER

- [ ] **`CERTIFICATE_ENCRYPTION_KEY`** — gerar com `openssl rand -hex 32` e adicionar nas env vars da Vercel antes de gerar qualquer certificado
- [ ] **Botão de acesso no site externo** — ao finalizar a plataforma, adicionar botão "Acessar Área de Membros" no site principal da Handify apontando para a URL da plataforma

## Fase 17 — Checagem de Segurança e Organização de Backend (Pré-launch)

### Segurança
- [ ] **RLS — revisão completa:** confirmar que todas as tabelas têm RLS ativo e policies cobrindo todos os cenários (student lê só o próprio, admin lê tudo, sem acesso anônimo a dados sensíveis)
- [ ] **Server Actions:** garantir que todas as mutações verificam role (`assertAdmin` / `assertStudent`) antes de qualquer operação
- [ ] **Webhook Payt:** testar HMAC com payload inválido (deve retornar 401), payload duplicado (idempotência), produto inexistente
- [ ] **Vídeo Panda:** confirmar que `video_panda_id` nunca chega ao client sem matrícula verificada — auditar todos os Server Actions de aula
- [ ] **Storage privado:** confirmar que todos os buckets de materiais e certificados exigem signed URL — nenhum arquivo acessível por URL direta
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
