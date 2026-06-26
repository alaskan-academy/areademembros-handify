# Handify Membros — Dev Notes

PRD e arquitetura completa em: `../CLAUDE.md`
Plano de execução em: `../PLAN.md`

## Comandos

```bash
npm run dev      # desenvolvimento (http://localhost:3000)
npm run build    # build de produção
npm run lint     # ESLint
npm run test     # Vitest
```

## Variáveis de Ambiente

Copiar `.env.local.example` → `.env.local` e preencher antes de rodar.

## Princípio: Backend-first

**Tudo que aparece no front end deve estar configurado no backend (Supabase).**
Antes de hardcodar qualquer dado, verifique se existe (ou deve existir) uma tabela que o gerencie:

| O que               | De onde deve vir                          |
|---------------------|-------------------------------------------|
| Itens de menu/nav   | `menu_items` (CRUD admin, sem deploy)     |
| Banners             | `banners` (vigência, slot, product_codes) |
| Vitrine             | `showcase_courses` (ordem, vídeo vendas)  |
| Páginas estáticas   | `static_pages` (FAQ, Sobre, Termos)       |
| Categorias de curso | `categories`                              |
| Cursos e aulas      | `courses`, `modules`, `lessons`           |

Labels de status, aria-labels e UI strings genéricas podem ser constantes no código. Dados que o admin deve controlar sem deploy nunca podem ser hardcoded.

**Pendente de implementar (itens hardcoded identificados):**
- `src/app/(student)/cursos/page.tsx` — texto do Hero hardcoded; deveria vir de `static_pages` ou `site_config`

## Página de aula — padrões visuais (jun/2026)

### Download de materiais (`src/components/lesson/content-blocks.tsx` — `DownloadBlock`)
- Card com `border-2 border-[#6699F3]/25 bg-[#6699F3]/5 rounded-xl p-4 sm:p-5`
- Ícone `Download` 48×48px com fundo azul suave (`bg-[#6699F3]/15`)
- Label "MATERIAL DA AULA" em azul maiúsculo acima do nome do arquivo
- Botão "Baixar" sólido azul (`bg-[#6699F3]`) com ícone, `min-h-[44px]` (WCAG)
- **Nunca voltar ao estilo anterior** (link de texto "Baixar" — alunas não viam)

### Botões de ação da aula (`src/app/(student)/aulas/[id]/page.tsx`)
- Layout: `flex flex-col gap-3` — sempre empilhado (nunca `flex-wrap` com `justify-between`)
- Linha 1: "Marcar como concluída" + badge "Prévia gratuita" (se aplicável)
- Linha 2: "Anterior" e "Próxima" em `grid grid-cols-2 gap-2 w-full`
  - Sempre simétrico 50/50 — `justify-center` em cada botão
  - Quando não há botão de um lado, usar `<div />` para manter o grid
  - Anterior: estilo border/outline; Próxima: sólido azul `bg-[#6699F3]`

## Modal de curso (`/cursos` — CursosGrid) — padrão obrigatório (jun/2026)

O modal que abre ao clicar num curso na listagem **sempre** deve exibir para qualquer aluna logada:
- Carga horária (`workload_hours`) e total de aulas (`totalLessons`)
- Lista completa de módulos com contagem de aulas e minutagem por módulo
- Aulas de cada módulo (expandível), com ícone de prévia ou cadeado

**Regra de implementação:** `src/app/(student)/cursos/page.tsx` usa `createServiceClient` (service role) para buscar cursos, módulos e aulas — nunca `createClient`. Isso é necessário porque a policy RLS de `lessons` bloqueia aulas não-prévia para não-matriculadas, fazendo o modal mostrar "0 aulas". O service client não expõe `video_panda_id` (esse campo não está na query desta página). Idem para `src/app/(student)/cursos/[slug]/page.tsx`.

**Nunca reverter para `createClient` nestas queries** sem também revisar as policies RLS de `lessons`.

## Convenções

- TypeScript strict — sem `any` explícito
- Server Actions para mutações; API routes apenas para webhooks externos (`/api/webhooks/payt`)
- `use server` / `use client` explícito em todo arquivo que precisar
- Zod para validar todos os inputs de forms e webhooks
- Nunca retornar `video_panda_id` ou URL de vídeo sem verificar `enrollment` server-side
- CPF nunca exposto em JSON; apenas no PDF do certificado

## Rate Limiting — Decisão e Roadmap

**Status (2026-06-24):** não implementado. Decisão consciente para o lançamento.

**Por que não bloqueou o lançamento:**
- Rotas de auth (`/login`, `/cadastro`, `/recuperar-senha`) → Supabase Auth já tem rate limiting próprio no servidor deles
- Webhook Payt (`/api/webhooks/payt`) → validação HMAC-SHA256 rejeita qualquer payload sem assinatura válida antes de qualquer processamento; risco real de sobrecarga é baixo para o porte atual

**Como implementar quando necessário:**
1. Criar conta gratuita no [Upstash](https://upstash.com) (plano free: 10.000 req/dia, sem cartão)
2. Instalar `@upstash/ratelimit` e `@upstash/redis`
3. Adicionar env vars `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
4. Criar helper em `src/lib/ratelimit.ts` e chamar no início de cada route handler/action sensível
5. Limites sugeridos: webhook → 20 req/min por IP; login → 5 tentativas/min por IP

**Quando revisar:** ao atingir escala (centenas de alunas ativas) ou se houver incidente de abuso.

## Captura de dados de leads — Fluxo completo (jun/2026)

Todos os dados do comprador vindos do Payt são capturados em múltiplas camadas para garantir máximo aproveitamento:

| Dado | Onde é salvo | Observação |
|------|-------------|------------|
| E-mail | `payment_events.buyer_email` + lookup de usuário | Chave de vinculação |
| Nome | `payment_events.buyer_name` (coluna dedicada) + `profiles.full_name` (se vazio) + `activation_tokens.buyer_name` | Nunca sobrescreve nome editado pela aluna |
| Telefone | `profiles.phone` (se vazio) + `activation_tokens.buyer_phone` | Nunca sobrescreve telefone editado pela aluna |
| CPF | `profiles.cpf_encrypted` (AES-256-GCM) + `profiles.cpf_hash` (SHA-256 para busca) | Sempre atualizado no grant |
| Transaction ID | `payment_events.payload` (JSON) | Campo `transaction_id` no payload bruto |
| Payload bruto | `payment_events.payload` (jsonb) | Tudo preservado para auditoria |

**Formulário de cadastro pós-compra** (`/cadastro/[email]`):
- Pré-preenche nome, CPF e telefone — prioriza `activation_tokens` (vinculado à compra), fallback para `payment_events`
- Nunca exige que a aluna redigite dados que o Payt já enviou

**Export CSV** (`/api/admin/alunos/export`):
Colunas: Nome, E-mail, Telefone, Nascimento, Qtd. Cursos, Cursos, Fonte, Data da 1ª Matrícula, Aulas Concluídas, Progresso Médio (%), Certificados, Última Atividade, Data de Cadastro, Status

## Política de acesso — 100% fechado sem login

**Regra não-negociável:** qualquer URL de `membros.handify.com.br` exige conta logada. Sem login → redireciona para `/login`. Sem exceções para alunas ou visitantes.

Rotas que ficam abertas sem login (necessidades técnicas, não alterar):
- `/login`, `/cadastro`, `/recuperar-senha`, `/nova-senha` — páginas de autenticação
- `/api/*` — webhooks externos (ex: Payt, server-to-server sem cookies)
- `/auth/*` — callback OAuth/magic-link do Supabase

Rotas que NÃO são mais públicas (mudança aplicada jun/2026):
- `/vitrine` — exige login
- `/cursos` — exige login
- `/p/[slug]` — páginas estáticas exigem login
- `/verificar/[hash]` — verificação de certificado exige login

Implementado em `src/proxy.ts` — `ALWAYS_PUBLIC_PREFIXES` contém apenas `/api/` e `/auth/`.

## Middleware — `src/proxy.ts` (regras críticas)

- Next.js reconhece `proxy.ts` como alias oficial de middleware. **Nunca criar `src/middleware.ts` junto** — ter os dois causa erro de build.
- O middleware usa `createServerClient` + **`supabase.auth.getSession()`** em todo request. Isso renova o access token localmente (sem rede) quando expira, disparando `setAll()` para gravar novos cookies na response.
- **Nunca usar `getUser()` no middleware** — faz requisição de rede ao Supabase em cada request, causando rate limit rapidamente (466 erros em minutos com o matcher abrangente). `getUser()` pertence a Server Actions e route handlers.
- A sessão persiste indefinidamente até logout manual do aluno.

## Fluxo de trabalho

- Ao final de cada alteração, sempre fazer `commit` e `push` para o remote.

## Webhook Payt — Formato do Payload Real

**Arquivos:** `src/lib/payments/payt.ts` + `src/app/api/webhooks/payt/route.ts`

### Campos importantes

| Campo no payload | O que é |
|-----------------|---------|
| `status` | Estado da transação: `"paid"` (libera acesso), `"refunded"` / `"chargeback"` / `"cancelled"` (revoga) |
| `transaction_id` | ID único da transação |
| `customer.email` | E-mail do comprador |
| `customer.name` | Nome do comprador |
| `customer.doc` | CPF do comprador (11 dígitos, usado para criptografar no perfil) |
| `customer.phone` | Telefone/WhatsApp |
| `product.code` | Code do produto principal (ou do grupo, se type=grouped) |
| `product.type` | `"digital"`, `"physical"` ou `"grouped"` |
| `product.items[]` | Se type=grouped: itens individuais com seus próprios `code` |
| `order_bumps[].product.code` | Code de cada order bump comprado junto |
| `test` | `true` quando disparado em modo teste no painel Payt |

### Como o sistema mapeia para cursos

1. Extrai todos os product codes do payload via `extractProductCodes()`:
   - Produto simples → `product.code`
   - Produto agrupado → cada `product.items[].code`
   - Order bumps → cada `order_bumps[].product.code`
2. Faz `SELECT * FROM courses WHERE product_code IN (...)` 
3. Para cada curso encontrado: cria ou revoga `enrollment`

**Conclusão:** para cada curso vendido (principal, item de grupo ou OB), cadastrar o `product_code` correspondente no admin da área de membros.

### Exemplo de payload real (Payt, nov/2024)

```json
{
  "status": "paid",
  "transaction_id": "PAYTS2",
  "test": true,
  "customer": {
    "email": "yoda@testsuser.com",
    "name": "Solaire of Astora M Walter White",
    "doc": "12345678909",
    "phone": "11999999999"
  },
  "product": {
    "code": "4O9J39",
    "type": "grouped",
    "name": "Produto Agrupado",
    "items": [
      { "code": "R28BKV", "type": "digital", "name": "Produto Digital Membros" },
      { "code": "45PK73", "type": "physical", "name": "Produto Fisico Frasco" }
    ]
  },
  "order_bumps": [
    { "code": "R3A674", "name": "Produto Order Bump", "product": { "code": "R6DAPD", "type": "digital", "name": "Ebook 1" } },
    { "code": "47ZMAL", "name": "OBump | Produto 2",  "product": { "code": "LX9BQZ", "type": "physical", "name": "Fisico (Auto)" } }
  ]
}
```

> Upsells chegam como webhook separado (nova compra). Order bumps chegam no mesmo payload em `order_bumps[]`.

### Correção aplicada (2026-06-24)

O schema original estava errado: esperava `event`, `product_code` e `buyer_email` no topo — campos que não existem no payload real. Resultado: todos os webhooks falhavam com 400. Corrigido para usar `status`, `product.code` e `customer.email`. Order bumps e reembolsos também passaram a funcionar.

## Embeds no menu

Quando a usuária pedir para embedar um site externo no menu, ela envia o link e eu crio uma página dedicada em `src/app/(student)/[nome]/page.tsx` que:
1. Autentica via Supabase server-side (`createClient`)
2. Redireciona para `/login` se não autenticada
3. Monta a URL com `?email=${encodeURIComponent(user.email ?? "")}` hardcoded no servidor
4. Renderiza um `<iframe>` que ocupa `calc(100svh - 104px)` entre header e footer

Nunca usar `/embed?url=...` — a URL de destino e o email ficam invisíveis na barra do navegador com páginas dedicadas.

## Web Push Notifications

**Status (2026-06-25):** implementado e funcional.

### Variáveis de ambiente
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=  # chave pública VAPID (exposta ao client)
VAPID_PRIVATE_KEY=             # chave privada VAPID (server-only)
VAPID_EMAIL=admin@handify.com.br
```
Configuradas em `.env.local` e nas env vars da Vercel.

### Tabela no Supabase
`push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)` — RLS ativo.
Migration: `supabase/migrations/20260625_push_subscriptions.sql`.

### Arquivos-chave
| Arquivo | O que faz |
|---------|-----------|
| `worker/index.ts` | Handler `push` + `notificationclick` no service worker |
| `src/lib/push/index.ts` | `broadcastPush`, `sendPushToUser` — **VAPID init é lazy** (`ensureVapid()` chamada no primeiro uso, não no import) |
| `src/lib/push/actions.ts` | Server Actions: `subscribePush`, `unsubscribePush`, `getUserPushEndpoints` |
| `src/components/pwa/PushSubscribeButton.tsx` | Botão ativar/desativar push no perfil da aluna |
| `src/components/pwa/PushPromptBanner.tsx` | Banner flutuante no student layout (inteligente: 15 dias, por dispositivo) |

### Regra crítica de build
`webpush.setVapidDetails()` **nunca** pode ser chamado no topo do módulo (module-level). Chamar no import quebra o build da Vercel porque a env var não existe em build time. Sempre usar `ensureVapid()` lazy dentro das funções de envio.

### Lógica do PushPromptBanner
- Aparece 1x para quem nunca viu
- Se aprovado antes mas sem subscription no dispositivo atual (ex: novo celular) → aparece novamente
- Se dispensado sem ativar → guarda timestamp em `localStorage` (`handify_push_prompt_dismissed_at`) e reexibe após 15 dias
- Se permission === "denied" → nunca aparece

## Segurança — checklist por PR

- [ ] Toda nova tabela Supabase tem RLS ativo
- [ ] Server Actions verificam role antes de mutar
- [ ] Inputs sanitizados (Zod + DOMPurify onde aplicável)
- [ ] Nenhum segredo exposto no client (`NEXT_PUBLIC_` apenas para Supabase URL e anon key)

## Segurança — correções aplicadas (pré-lançamento)

| Data | Arquivo | Problema | Fix |
|------|---------|----------|-----|
| 2026-06-24 | `src/lib/sanitize/index.ts` | Atributo `style` no ALLOWED_ATTR permitia CSS injection via blocos de aula criados pelo admin | Removido `"style"` da lista; usar classes CSS ao invés de estilos inline |
| 2026-06-24 | `src/app/(student)/comunidade/forum/actions.ts` | Upload aceitava qualquer tipo de arquivo — aluna podia fazer upload de arquivo malicioso renomeado como imagem | Adicionada validação de MIME type: só aceita `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| 2026-06-24 | `src/lib/notifications/actions.ts` | `getUnreadCount` e `getNotifications` usavam service client com `userId` vindo do caller sem verificar a sessão — qualquer aluna autenticada podia ler notificações de outra | Adicionada verificação `user.id === userId` antes de consultar; retorna vazio silenciosamente se não bater |
| 2026-06-24 | `next.config.ts` | Headers de segurança incompletos | Adicionados: HSTS (2 anos, só produção), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, Typeform no `frame-src` |
| 2026-06-25 | `src/app/(admin)/admin/comunidade/forum/actions.ts` | `rejectForumPost` e `deleteAdminForumPost` deletavam posts de alunas sem registrar nada no `audit_log` — ações admin de remoção de conteúdo sem trilha de auditoria | Adicionados inserts em `audit_log` via `createServiceClient` em ambas as ações; `assertAdmin` agora retorna `adminId` além do cliente |
| 2026-06-25 | `src/app/api/webhooks/payt/route.ts` | Phone e nome do comprador não eram salvos no perfil da aluna já existente — dado perdido a cada compra | Webhook agora salva `phone` (se vazio) e `full_name` (se vazio) via UPDATE condicional; nunca sobrescreve dado editado pela aluna |
| 2026-06-25 | `supabase/migrations/028_leads_and_audit_fix.sql` | `audit_log.action` era enum com valores antigos incompatíveis com o código (`ban` vs `ban_user` etc) — todos os inserts de ban/unban/update_email/forum falhavam silenciosamente | Convertido para `text`; `admin_id` tornado nullable para ações automáticas do webhook (migration rodada em produção jun/2026) |

### Headers de segurança configurados (`next.config.ts`)

| Header | Valor | O que faz |
|--------|-------|-----------|
| `X-Frame-Options` | `DENY` | Impede que a plataforma seja carregada em `<iframe>` de outro site (anti-clickjacking) |
| `X-Content-Type-Options` | `nosniff` | Impede que o browser execute um arquivo com tipo diferente do declarado (ex: `.txt` como JS) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Ao navegar para site externo (ex: Payt), envia só o domínio no Referer, não a URL completa |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Desativa câmera, microfone e geolocalização — a plataforma não usa nenhum deles |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Força HTTPS por 2 anos após a primeira visita. Browser rejeita HTTP sem nem chegar ao servidor. **Só ativo em produção** |
| `Content-Security-Policy` | (ver abaixo) | Lista branca de tudo que a página pode carregar |

**Diretivas do CSP:**

| Diretiva | Fontes permitidas | Motivo |
|----------|------------------|--------|
| `default-src` | `'self'` | Padrão restritivo: tudo bloqueado salvo exceções abaixo |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` + Panda Video | Next.js exige `unsafe-inline`/`unsafe-eval`; Panda Video precisa carregar scripts do player |
| `frame-src` | Panda Video, Google Forms, YouTube, Notion, Canva, Typeform, `*.handify.com.br` | Embeds permitidos nas aulas (allowlist do DOMPurify espelhada aqui) |
| `img-src` | `'self' data: blob: https:` | Thumbnails do Supabase Storage e imagens externas nos posts |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind e shadcn/ui usam estilos inline |
| `connect-src` | Supabase (HTTPS + WSS), Panda Video | Requisições de rede: banco, realtime e player |
| `media-src` | `'self' blob:` + Panda Video | Vídeos do player |
| `font-src` | `'self'` | Montserrat é servida localmente via `next/font` — sem chamada ao Google Fonts em runtime |
| `object-src` | `'none'` | Bloqueia Flash, Java e qualquer plugin |
| `base-uri` | `'self'` | Impede injeção de `<base href="...">` que redirecionaria todos os links da página |
| `frame-ancestors` | `'none'` | Equivalente moderno do `X-Frame-Options` no CSP (mantidos os dois por compatibilidade) |
