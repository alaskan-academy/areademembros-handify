# Handify — Área de Membros

Plataforma de cursos online de artesanato inspirada na Domestika, com identidade visual da Handify. Alunas compram cursos avulsos ou assinam plano, assistem aulas em vídeo, acompanham progresso e participam de comunidade.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Backend/DB/Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Vídeo:** Panda Video (player embutido via iframe SDK)
- **Pagamento:** Payt — integração via webhook para liberação de acesso por `product_code`
- **E-mail transacional:** Resend (templates HTML, envio via Supabase Edge Function ou Server Action)
- **Estilização:** Tailwind CSS + shadcn/ui
- **Deploy:** Vercel (PWA configurado via `next-pwa`)

## Estrutura do Projeto

```
src/
  app/
    (auth)/
      login/
      cadastro/
      recuperar-senha/
    (student)/
      dashboard/
      cursos/[slug]/
      aulas/[id]/
      comunidade/
        feed/            # feed de notícias (somente admin posta)
        forum/[curso]/   # fórum por curso
      vitrine/
      busca/
      perfil/
      notificacoes/
    (admin)/
      cursos/
      alunos/
      banners/
      vitrine/
      menu/
      paginas/
      comunidade/
        feed/            # gerenciar posts do feed de notícias
        forum/           # moderar fórum por curso
      metricas/
      emails/
    p/[slug]/            # páginas estáticas (FAQ, Sobre, Termos)
    verificar/[hash]/    # verificação pública de certificado
    api/
      webhooks/
        payt/
  components/
    ui/
    player/
    banner/
    vitrine/
    menu/
    notifications/
    search/
  lib/
    supabase/
    video/
    payments/
    pdf/
    email/
    sanitize/
    search/
```

## Modelo de Negócio

- **Compra avulsa:** acesso vitalício a curso específico
- **Assinatura:** plano mensal/anual → enrollment em todos os cursos `is_subscription_only: true`
- **Checkout externo:** Payt → webhook POST notifica compra com `product_code`
- **Liberação de acesso:** webhook valida HMAC, busca curso pelo `product_code`, registra `enrollment`
- **Reembolso/cancelamento:** webhook revoga enrollment e registra em `audit_log`

## Funcionalidades — Aluna

### Cursos e Aulas
- Listagem de cursos com filtro por categoria
- **Preview gratuita:** primeira aula de cada módulo marcada como pública — acessível sem login
- Página de curso: descrição, módulos, professora, preço, botão comprar → link Payt
- Player Panda Video (ID buscado via Server Action após verificar matrícula server-side)
- **Continuar de onde parou:** salvar `last_position` a cada 10s (debounce)
- **Marcar aula concluída:** botão explícito ou auto-mark ao atingir 90% da duração
- **Barra de progresso:** `(aulas_concluídas / total_aulas) * 100` calculado server-side
- **Certificado PDF:** nome completo + CPF + título do curso + carga horária + data de conclusão + QR code de verificação
- URL pública `/verificar/[hash]` confirma autenticidade do certificado

### Busca Global
- Campo de busca acessível de qualquer página (atalho de teclado `Ctrl+K` / `⌘K`)
- Retorna: cursos, aulas e posts do feed de notícias
- Implementado com `pg_trgm` via Supabase (full-text search em português)
- Resultados agrupados por tipo com ícone identificador

### Vitrine (Showcase Público)
- Página `/vitrine` acessível sem login
- Cards de curso: thumbnail, título, categoria, carga horária, preço, badge "Prévia grátis"
- Clicar abre **modal com mini PV** (vídeo de vendas Panda Video separado do vídeo de aula)
- Modal: vídeo + descrição + tópicos + botão "Comprar agora" → link Payt
- Admin configura cursos, ordem e ID do vídeo de vendas

### Banner Condicional
- Banners exibidos apenas para alunas que **não possuem** o produto/curso associado
- Cada banner: imagem, link, `product_codes[]`, slot de posição, vigência
- Slots: header, lateral, pós-aula
- Visitantes sem login veem todos os banners ativos

### Menu Editável
- Navegação configurável pelo admin sem deploy
- Cada item: label, URL, ícone (Lucide), visibilidade (`guest` | `student` | `admin`), posição, pai
- Sub-menus de 1 nível de profundidade
- Links externos com `rel="noopener noreferrer"`

### Blocos de Conteúdo HTML/Embed
- Aulas podem ter blocos além do vídeo: `text` | `html` | `embed` | `download`
- HTML editado pelo admin (Monaco Editor ou textarea)
- Embeds de domínios allowlistados: Google Forms, Typeform, Notion, Canva, YouTube
- Sanitização DOMPurify com allowlist estrita antes de renderizar

### Comunidade

**Feed de Notícias (somente admin posta)**
- Seção de acesso público ou restrito a alunas (configurável)
- Admins publicam: novos cursos, avisos, novidades, dicas, destaques
- Posts podem ter texto + imagem + embed + link
- Alunas podem comentar nos posts de notícias
- **Aluna em Destaque:** tipo especial de post no feed, admin seleciona projeto/perfil de aluna para destacar
- Posts aparecem em ordem cronológica; fixar posts importantes (admin)
- Dispara notificação para todas as alunas ao publicar novo post

**Fórum por Curso**
- Cada curso tem seu próprio espaço de discussão
- Alunas matriculadas postam dúvidas, projetos e comentários
- Admin/professora pode responder e fixar posts
- Threads com comentários aninhados (1 nível)
- Reportar post/comentário inapropriado

**Regras gerais da comunidade:**
- Criar post: texto + imagem (Storage)
- Curtir posts e comentários
- Perfil público da aluna: bio, foto, projetos postados no fórum
- Reportar conteúdo → fila de moderação

### Central de Notificações (sino)
- Badge com contagem de não lidas no header
- Eventos que disparam notificação:
  - Admin publicou no feed de notícias
  - Resposta ao seu comentário (fórum ou feed)
  - Novo conteúdo adicionado ao curso matriculado
  - Curso concluído (celebração)
  - Certificado disponível para download
- Painel de notificações: lista com timestamp, tipo e link de destino
- Marcar como lida individualmente ou "marcar todas como lidas"

### E-mails Automáticos (Resend)
- **Boas-vindas:** ao criar conta
- **Acesso confirmado:** após webhook Payt processar a compra (inclui link do curso)
- **Parabéns + certificado:** ao completar curso (PDF em anexo ou link de download)
- **Lembrete de reengajamento:** 7 dias sem acessar curso em andamento
- **Novo post no feed:** notificação opt-out para alunas (preferência no perfil)
- Templates HTML com identidade visual Handify

### Perfil da Aluna
- Foto, bio, nome (editável)
- Meus cursos: lista com progresso e link para retomar
- Meus certificados: download PDF + link de verificação
- Histórico de matrículas
- Preferências de e-mail (opt-out por tipo de notificação)

## Funcionalidades — Admin

### Gestão de Cursos
- CRUD de cursos: título, slug, descrição, thumbnail, categoria, preço, `product_code` (Payt), workload em horas, tipo, publicado
- CRUD de módulos e aulas
- Por aula: título, ID vídeo Panda, duração, se é prévia gratuita (checkbox), blocos de conteúdo, materiais
- CRUD de `lesson_content_blocks` (drag-and-drop de posição)

### Vitrine Admin
- Selecionar cursos e ordem na vitrine
- Configurar ID do vídeo de vendas (mini PV) por curso — separado do vídeo de aula

### Banners Admin
- CRUD de banners: imagem, link, `product_codes[]`, slot, vigência, ativo/inativo
- Preview antes de publicar

### Menu Admin
- CRUD de itens de menu: label, URL, ícone, visibilidade, posição, pai
- Reordenação por posição numérica

### Feed de Notícias Admin
- Criar/editar/deletar posts do feed (texto + imagem + blocos embed)
- Fixar posts no topo
- Selecionar "Aluna em Destaque" com link para perfil

### Gestão de Alunas
- Listagem com busca por e-mail/nome
- Ver cursos, progresso, certificados, histórico
- Dar/revogar acesso manual com motivo → `audit_log`
- Exportar lista em CSV (nome, e-mail, cursos, data matrícula)

### Métricas (Dashboard)
- Total de alunas ativas, matrículas por curso, taxa de conclusão
- Certificados emitidos
- Top cursos por matrícula
- Webhooks Payt recentes (status: processado/pendente/erro)
- Exportar relatórios em CSV

### Moderação de Comunidade
- Fila de conteúdo reportado (posts fórum, posts feed, comentários)
- Deletar conteúdo + notificar autora (opcional)
- Banir/suspender aluna da comunidade → `audit_log`

### Páginas Estáticas Admin
- CRUD de `/p/[slug]`: FAQ, Sobre, Termos de Uso, Política de Privacidade
- Blocos de conteúdo HTML/embed igual às aulas

## Roadmap Futuro (Fora do Escopo Atual)

- Trilhas de aprendizado (sequência curada de cursos)
- Cupons de desconto rastreáveis
- Pacotes/bundles de cursos
- Desafios mensais da comunidade
- Aplicativo nativo (React Native / Expo)

## Segurança — Regras Não Negociáveis

1. **RLS ativo em todas as tabelas Supabase** — nenhuma tabela sem Row Level Security
2. **Roles explícitas:** `student` | `admin` — verificadas no middleware Next.js e nas policies do Supabase
3. **Webhook Payt validado por HMAC** — rejeitar com 401 qualquer payload sem assinatura válida
4. **Vídeo Panda nunca exposto sem matrícula** — ID do vídeo retornado apenas via Server Action após verificar `enrollment`
5. **Prévia gratuita:** `is_preview` validado server-side; mesmo campos de aula prévia não retornam dados de aulas pagas adjacentes
6. **Storage privado:** materiais e certificados acessíveis via signed URL (TTL 60 min)
7. **Rate limiting:** `/api/webhooks/payt` e rotas de auth com rate limit (Upstash Redis ou Vercel middleware)
8. **CSRF:** mutações via Server Actions; API routes apenas para webhooks externos
9. **Sanitização de HTML:** DOMPurify com allowlist de tags; embeds apenas de domínios allowlistados; nunca confiar em input admin sem sanitização
10. **CPF protegido:** criptografado no banco (`pgcrypto`); nunca exposto em JSON de resposta ou logs; apenas no PDF do certificado
11. **Hash de certificado:** UUID v4 não sequencial — não permite enumeração
12. **Logs de auditoria:** ações admin registradas em `audit_log` com `admin_id`, `action`, `target`, `meta`, `created_at`
13. **E-mails transacionais:** links com tokens de curta duração; nunca incluir senha ou dados sensíveis no corpo do e-mail

## Banco de Dados — Tabelas Principais

```sql
-- Usuários
profiles (id, email, full_name, cpf_encrypted, avatar_url, bio, role, banned, email_prefs, created_at)

-- Catálogo
categories (id, name, slug)
courses (
  id, slug, title, description, thumbnail_url,
  category_id, price, product_code,
  workload_hours, is_subscription_only,
  published, position, created_at
)
modules (id, course_id, title, position)
lessons (id, module_id, title, video_panda_id, duration_seconds, is_preview, position)
lesson_content_blocks (id, lesson_id, type, content, position)
lesson_materials (id, lesson_id, name, file_path)

-- Acesso e Progresso
enrollments (id, user_id, course_id, source, granted_at, expires_at)
lesson_progress (id, user_id, lesson_id, completed, last_position, updated_at)
certificates (id, user_id, course_id, verify_hash, issued_at, pdf_path)

-- Pagamentos
payment_events (id, platform, product_code, event_type, buyer_email, payload, processed, error, created_at)

-- Vitrine
showcase_courses (course_id, sales_video_panda_id, position, active)

-- Banners
banners (id, title, image_url, link_url, product_codes, position_slot, starts_at, ends_at, active)

-- Menu
menu_items (id, label, url, icon, target, visible_to, position, parent_id)

-- Páginas estáticas
static_pages (id, slug, title, blocks, published, created_at)

-- Comunidade — Feed de Notícias (admin-only)
news_posts (id, author_id, title, body, image_url, blocks, pinned, published, created_at)
news_comments (id, post_id, user_id, body, created_at)

-- Comunidade — Fórum por Curso
forum_posts (id, course_id, user_id, title, body, image_url, pinned, created_at)
forum_comments (id, post_id, parent_id, user_id, body, created_at)
post_likes (target_type, target_id, user_id)  -- polimórfico: news_post | forum_post

-- Notificações
notifications (id, user_id, type, title, body, link, read, created_at)

-- Moderação e Auditoria
reports (id, reporter_id, target_type, target_id, reason, resolved, created_at)
audit_log (id, admin_id, action, target_type, target_id, meta, created_at)
```

## Design — Identidade Visual Handify™

> Skill oficial: `anthropic-skills:handify-idv` — invocar via `/handify-idv` sempre que criar peça visual.
> Toda decisão visual deve passar pelo checklist da skill antes de ser commitada.

### Paleta de Cores (hex exatos — nunca aproxime)

| Token CSS               | HEX       | Uso                                      |
|-------------------------|-----------|------------------------------------------|
| `--handify-blue`        | `#6699F3` | CTA principal, links, destaques, ring    |
| `--handify-green`       | `#72CF92` | Sucesso, accent secundário               |
| `--handify-yellow`      | `#FEC649` | Faixa decorativa tricolor, detalhe       |
| `--handify-black`       | `#0F0F0F` | Fundos escuros, dark mode                |
| `--handify-gray-dark`   | `#2D2D2D` | Texto principal (`--foreground`)         |
| `--handify-off-white`   | `#F5F5F0` | Fundo editorial, `--muted`, `--secondary`|

Tailwind disponível: `bg-handify-blue`, `text-handify-green`, `bg-handify-muted`, etc.

### Tipografia

- **Fonte principal:** Montserrat (400, 500, 600, 700, 900) — obrigatória em tudo
- **Fontes criativas** (posts sociais, peças de mídia): Caveat / Playfair Display
- **Nunca:** Inter, Roboto, Open Sans, Poppins, Montserrat Condensed
- **Nunca:** Caveat em textos corridos (só títulos de posts criativos)
- Carregada via `next/font/google` → variável `--font-montserrat`
- Tamanho mínimo: 12px digital

### Logo

- Usar **sempre** o arquivo oficial de `assets/logos/` da skill
- **™ obrigatório** em todos os entregáveis da plataforma (PDFs, certificados, e-mails, vídeos)
- Zona de proteção: 2× a altura do "H" maiúsculo em todos os lados
- **Fundos claros:** texto em `#6699F3` | **Fundos escuros:** texto em branco
- Tamanho mínimo digital: horizontal 120px, ícone 40px
- Marca d'água em vídeos: `logo-vertical-tm-azul.png`, 125×97px, canto inf. dir., margem 79px/98px, opacidade 60–70%

### Componentes visuais

```css
/* Faixa tricolor — usar no topo de páginas e rodapés */
.brand-stripe { display: flex; height: 4px; }
.brand-stripe span:nth-child(1) { flex: 1; background: #6699F3; }
.brand-stripe span:nth-child(2) { flex: 1; background: #72CF92; }
.brand-stripe span:nth-child(3) { flex: 1; background: #FEC649; }

/* Card padrão */
border-radius: 12px;
border: 1px solid oklch(0.90 0.003 100);
box-shadow: 0 1px 3px rgba(0,0,0,0.08);

/* Botão primário */
background: #6699F3; color: #fff; border-radius: 6–8px;

/* Destaque de palavra em título */
<span class="accent-word">palavra</span> → color: #6699F3
```

### Mapeamento shadcn → Handify

| Token shadcn    | Valor Handify       |
|-----------------|---------------------|
| `--primary`     | `#6699F3` (azul)    |
| `--accent`      | `#72CF92` (verde)   |
| `--secondary`   | `#F5F5F0` (off-white)|
| `--muted`       | `#F5F5F0`           |
| `--foreground`  | `#2D2D2D`           |
| `--ring`        | `#6699F3`           |
| `--radius`      | `0.5rem` (8px)      |

### Acessibilidade

- Contraste mínimo WCAG AA **4.5:1** para body text
- **Nunca** texto azul sobre fundo verde ou amarelo
- Alt text em todas as imagens; aria-labels em modais e notificações
- Foco visível em todos os elementos interativos

### Transições

- Padrão: `250ms ease-out` (range: 200–300ms)
- Classe utilitária: `.handify-transition`

### Referência de experiência

- Domestika — layout neutro, foco no conteúdo, cards grandes
- Mobile-first — maioria das alunas acessa pelo celular

## Convenções de Código

- TypeScript strict mode
- Zod para validação de todos os schemas (formulários, webhooks, blocos)
- Server Actions para mutações; API routes apenas para webhooks externos
- `use server` / `use client` explícitos em todos os arquivos
- Testes: Vitest para lógica crítica (progresso, webhook, hash certificado, sanitização)
- Nunca hardcodar segredos — sempre via `.env.local` / Vercel env vars
- Commits semânticos: `feat:`, `fix:`, `chore:`, `security:`

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYT_WEBHOOK_SECRET=
PANDA_VIDEO_API_KEY=
RESEND_API_KEY=
CERTIFICATE_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_URL=              # ex: https://membros.handify.com.br
```
