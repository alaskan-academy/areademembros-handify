# Plano — Migração de Alunas (Membrify → Handify Área de Membros)

## Objetivo

Criar um funil separado e oculto (`/ativar`) que permite às alunas da plataforma antiga
criarem conta na nova área de membros de forma guiada, com dados pré-preenchidos vindos
da Payt. Após 1-2 meses, o funil é desativado; quem tem conta usa o login normal.

---

## Estrutura de rotas

```
src/app/
  ativar/
    layout.tsx            ← layout próprio (noindex, sem menu)
    page.tsx              ← Passo 1: campo de e-mail
    completar/
      page.tsx            ← Passo 2: formulário idêntico ao cadastro, com pré-preenchimento
      CompletarAtivarForm.tsx  ← Client Component do formulário
    actions.ts            ← Server Actions dos dois passos
```

> Fora do grupo `(auth)` para manter separação total.
> Visualmente usa os mesmos componentes Card/Input/Button do cadastro.

---

## Banco de dados

### Nova tabela: `migration_candidates`

```sql
CREATE TABLE migration_candidates (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  full_name       text,
  cpf_raw         text,          -- CPF vindo da Payt; apagado após ativação
  phone           text,          -- se disponível na Payt
  product_codes   text[],        -- array de product_codes comprados na Payt
  token           text,          -- token curto gerado no Passo 1, expira em 30min
  token_expires   timestamptz,
  activated_at    timestamptz,   -- null = ainda não ativou; preenchido ao criar conta
  created_at      timestamptz DEFAULT now()
);

-- índice para lookup rápido por token (Passo 2)
CREATE INDEX ON migration_candidates (token) WHERE token IS NOT NULL;
```

**Segurança do CPF:** `cpf_raw` é texto simples temporariamente (necessário para pré-preenchimento).
Após a aluna completar o cadastro, o campo é apagado (`UPDATE SET cpf_raw = NULL`).
O CPF definitivo vai para `profiles.cpf_encrypted` via a mesma lógica do cadastro normal.

### Sem migração de schema existente
Todas as outras tabelas (`profiles`, `enrollments`, `activation_tokens`) continuam intactas.
O fluxo de ativação concede matrículas diretamente por `course_id` (sem depender de product_code).

---

## Importação dos dados da Payt

### Estratégia de mapeamento (resolvido em 2026-07-15)

A Payt disponibiliza dois exports:
- **Relatório de vendas** (`vendas_*.xlsx`) — uma linha por compra
- **Relatório de produtos** (`produtos_*.xlsx`) — uma linha por produto

O `SKU` longo (`6a14d4177235b-fabrica-das-velas-de-lembrancinha`) é **idêntico** nos dois arquivos. O relatório de produtos tem a coluna `Código` (A) que é o product code curto (`4MJ9YD`) — o mesmo que está em `courses.product_codes`.

**Fluxo de mapeamento automático (sem trabalho manual):**
```
vendas.Sku  →  produtos.SKU  →  produtos.Código  →  courses.product_codes  →  course_id
```

O `payment_events` (webhook) não é usado: só tem 13 dias de histórico.

### Arquivos de vendas — fragmentação (Payt limita a 90 dias por export)

A Payt não permite export de período maior que 90 dias. Os 3 fragmentos identificados (2026-07-15):

| Arquivo | Linhas |
|---------|--------|
| `vendas_15_07_2026.xlsx` | 3.369 |
| `vendas_15_07_2026 (1).xlsx` | 4.769 |
| `vendas_15_07_2026 (2).xlsx` | 765 |
| **Total** | **8.903 linhas** |

> Havia outros exports com datas duplicadas na pasta Downloads — os 3 acima foram identificados por contagem de linhas (batem com os totais da análise anterior).

### Colunas usadas do relatório de vendas

| Campo no relatório | Coluna | Observação                                       |
|--------------------|--------|--------------------------------------------------|
| `Email`            | AG     | chave de identificação                           |
| `Cliente`          | C      | nome — pode vir em CAIXA ALTA, script normaliza  |
| `Documento`        | AH     | CPF como dígitos puros (`00139010521`)           |
| `Telefone`         | AP     | telefone como dígitos puros (`71988229881`)      |
| `Sku`              | E      | chave de join com o relatório de produtos        |
| `Status Compra`    | K      | filtrar só `Compra Aprovada`                     |
| `Status Pagamento` | L      | filtrar só `Pagamento Aprovado`                  |

### Colunas usadas do relatório de produtos

| Campo no relatório | Coluna | Observação                                       |
|--------------------|--------|--------------------------------------------------|
| `Código`           | A      | product code curto → cruza com `courses.product_codes` |
| `SKU`              | F      | chave de join com o relatório de vendas          |

---

## Filtro de qualificação (definido em 2026-07-15)

Só entra na migração quem comprou **pelo menos 1** dos 7 códigos qualificantes:

| Código | Produto | Tipo |
|--------|---------|------|
| `4MJ9YD` | Fábrica das Velas de Lembrancinha | Curso principal |
| `R2JAJA` | Workshop Buquê de Velas | Curso principal |
| `RW2MMP` | Saponaria Brasil | Curso principal |
| `4NYAEE` | Velaroma Artesanal | Curso principal |
| `LPGKQ8` | Handify Artesanato Completo | Bundle (contém os 4 principais) |
| `RKJWA8` | Combo Saponaria + Velaroma | Bundle |
| `L9QEPN` | Kit Completo (Fábrica + Workshop) | Bundle |

**OBs e upsells não qualificam sozinhos** — quem os comprou necessariamente já tem um principal junto.

**Bundless que NÃO qualificam** (não contêm nenhum dos 4 principais):
- `4NGWBO` — Combo Mestre das Velas Artesanais (Arte Floral, Kit Casa Cheirosa, Embalagens, Saboaria Energética)
- `4M2BDD` — Kit Completo da Artesã (100 Assinaturas, Difusores, Loja Online)

### Resultado do dry-run (2026-07-15)

| | Qtd |
|---|---|
| Vendas aprovadas (de 8.903 linhas) | 6.477 |
| Candidatas únicas (antes do filtro) | 5.480 |
| **Qualificadas (entram na migração)** | **3.657** |
| Excluídas (sem curso principal) | 1.823 |

As 1.823 excluídas são quase todas clientes de `LPAGXG` (Velas Perfeitas 2.0) e `LGBA36` (Cosmética Natural) — ecosistemas com área de membros própria. O filtro funcionou exatamente como esperado, sem casos ambíguos relevantes.

### Script de importação

`scripts/import-payt-candidates.ts` — aceita múltiplos `--vendas`, aplica filtro de qualificação e gera relatório de anomalias.

```bash
cd handify-membros
npx tsx scripts/import-payt-candidates.ts \
  --vendas "vendas_15_07_2026.xlsx" \
  --vendas "vendas_15_07_2026 (1).xlsx" \
  --vendas "vendas_15_07_2026 (2).xlsx" \
  --produtos "produtos_15_07_2026.xlsx" \
  [--dry-run]
```

---

## Fluxo técnico

### Passo 1 — `/ativar` (verificação de e-mail)

**Server Action `checkAtivarEmailAction(email)`:**
1. Busca `migration_candidates` pelo e-mail (case-insensitive)
2. **Não encontrado →** retorna erro:
   > "Este e-mail não está na nossa base de compradores. Verifique se usou o mesmo e-mail da compra. Dúvidas? [suporte]"
3. **`activated_at` preenchido →** redireciona para `/login?msg=ja-tem-conta`
4. **E-mail já existe em `auth.users` (conta criada antes pelo cadastro normal) →**
   Concede matrículas pendentes + redireciona para `/login?msg=acesso-liberado`
5. **Encontrado e sem conta →** gera token 8 chars (charset sem ambiguidade), salva com expiração 30 min, redireciona para `/ativar/completar?t=TOKEN`

### Passo 2 — `/ativar/completar?t=TOKEN` (formulário)

**Server Component (page.tsx):**
- Lê `t` dos searchParams
- Busca `migration_candidates` pelo token + valida `token_expires > now()`
- Token inválido/expirado → redireciona para `/ativar?erro=token-invalido` ou `token-expirado`
- Passa `{ email, full_name, cpf_raw, phone }` como props ao formulário

**Formulário (CompletarAtivarForm.tsx — Client Component):**
- Campos **idênticos** ao cadastro atual:
  - Nome completo — pré-preenchido (editável)
  - E-mail — pré-preenchido + **somente leitura**
  - WhatsApp — pré-preenchido se disponível (editável)
  - CPF — pré-preenchido se disponível (editável)
  - Data de nascimento (opcional)
  - Senha + Confirmar senha
- Input hidden com `token`

**Server Action `completarAtivarAction(formData)`:**
1. Valida token e busca candidato (segunda validação server-side)
2. Valida dados com `cadastroSchema` (Zod — mesmo schema do cadastro)
3. **Conflito de CPF** → erro: "Este CPF já está vinculado a outra conta."
4. Cria usuário via `service.auth.admin.createUser` (`email_confirm: true`)
5. Atualiza `profiles`: CPF criptografado, phone, data de nascimento
6. Concede matrículas via `grantMigrationEnrollments` (busca cursos por `overlaps("product_codes", codes)`)
7. Limpa dados sensíveis: `cpf_raw = NULL, token = NULL, activated_at = now()`
8. Auto-login + redireciona para `/cursos`

### Alterações em arquivos existentes

- `src/proxy.ts` — `/ativar` adicionado em `PUBLIC_ROUTES`
- `src/app/(auth)/login/page.tsx` — banner verde para `?msg=acesso-liberado` e `?msg=ja-tem-conta`

---

## Tratamento de casos-limite

| Situação                               | Comportamento                                                |
|----------------------------------------|--------------------------------------------------------------|
| CPF igual ao da Payt                   | Fluxo normal — salvo e criptografado                        |
| CPF diferente (aluna corrige o próprio)| Permitido — Payt pode ter erro de digitação                 |
| CPF já existe em outro perfil          | Erro claro + instrução para suporte                         |
| Telefone qualquer                      | Sem restrição de unicidade — salvo sem conflito             |
| E-mail já tem conta no Supabase        | Detectado no Passo 1 → concede matrículas + vai para login  |
| Token expirado (>30 min)               | Volta para Passo 1 com mensagem amigável                    |
| Candidato já ativado                   | Vai para `/login` com aviso que já tem conta                |

---

## Layout e visibilidade

- `ativar/layout.tsx`: sem menu de navegação, sem header da app
- `<meta name="robots" content="noindex, nofollow">` — não indexado pelo Google
- Não aparece em nenhum link interno da plataforma
- Só é acessível via link enviado no e-mail de migração

---

## Campanha de e-mail (integração com Resend)

Cada candidato recebe e-mail personalizado com:
- Link para `/ativar` com instrução clara: "Use o e-mail que você usou na compra"
- Botão grande e simples

Script separado: `scripts/send-migration-emails.ts` (ainda não criado)
- Lê `migration_candidates` onde `activated_at IS NULL`
- Dispara em lotes via Resend (respeitar rate limit: 100 e-mails/seg)

---

## Desativação após período de migração

Após 1-2 meses:
1. Verificar quantas candidatas restam sem `activated_at`
2. Enviar lembrete para as não-ativadas
3. Redirecionar `/ativar` para `/login` com mensagem:
   > "O período de migração encerrou. Recupere seu acesso via 'Esqueci minha senha'."
4. Manter tabela `migration_candidates` para auditoria (pode apagar `cpf_raw` de todos)

---

## Ordem de implementação

- [x] 1. Criar tabela `migration_candidates` no Supabase (migration `20260715_migration_candidates.sql`)
- [x] 2. Escrever script de importação (`scripts/import-payt-candidates.ts`)
- [x] 3. Mapear `product_codes` da Payt → join automático via SKU; filtro de 7 códigos qualificantes definido
- [x] 4. Criar `src/app/ativar/layout.tsx`
- [x] 5. Criar Passo 1 (`/ativar/page.tsx` + action `checkAtivarEmailAction`)
- [x] 6. Criar Passo 2 (`/ativar/completar/page.tsx` + `CompletarAtivarForm.tsx` + action `completarAtivarAction`)
- [x] 6a. Adicionar `/ativar` em `PUBLIC_ROUTES` (`src/proxy.ts`)
- [x] 6b. Adicionar banners de msg verde na página de login
- [x] 6c. Executar dry-run → 3.657 qualificadas confirmadas, filtro validado
- [x] 7. Testar fluxo completo com candidato fictício — validado em 2026-07-16 (3 matrículas criadas, source=migration)
- [x] 8. Rodar importação real (sem `--dry-run`) → 3.657 candidatas gravadas em 2026-07-16 (0 erros)
- [ ] 9. Escrever e testar script de e-mails (`send-migration-emails.ts`)
- [ ] 10. Deploy + enviar e-mails em lote
- [ ] 11. Monitorar ativações; enviar lembrete após 30 dias
- [ ] 12. Desativar rota após encerramento do período
