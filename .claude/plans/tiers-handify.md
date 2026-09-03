# Plano: Tiers Handify — Visitante · Aluna · Handify Completo

Escrito em 03/09/2026. Números medidos direto no banco de produção nesse dia.
Decisões tomadas com a Jessica na conversa do mesmo dia.

---

## 0. Raio-X que motivou o plano

**3.387 alunas** (sem contar admin). Plataforma no ar desde jul/2026.
Desde o lançamento: 3.547 compras, R$ 318 mil. Gasto médio por compradora **R$ 99**,
mediana R$ 83. Só **271** compraram mais de uma vez — o LTV trava na primeira compra.

| Segmento | Alunas | Leitura |
|---|---|---|
| Só cadastro, nenhum curso | 28 | Tier gratuito já existe de fato — sem propósito nem página |
| 1 curso | 2.064 (61%) | Entram por Saponaria (R$67), Buquê (R$47), Lembrancinha (R$97) |
| 2–3 cursos | 534 | |
| **4–10 cursos, sem plano** | **699** | Alvo do upgrade: já gastaram ~R$300 em partes |
| Handify Completo (comprou) | 58 | R$ 21,6 mil = **6,8% da receita**. Ticket R$ 327 |

Origem das matrículas: payt 7.481 · migração 931 · manual 256 · kiwify 0.

### Três achados que vêm antes de qualquer tier

**A. A oferta do Completo está invisível para 99%.** A barra "Seja Premium" era
escondida de quem tinha matrícula em *qualquer* curso cujos `checkout_codes`
contivessem o código do plano. Como o código do plano (`LPGKQ8`) foi colado em 23
dos 24 cursos para que a compra do plano liberasse todos, quem comprou só Saponaria
(`RW2MMP, RKJWA8, LPGKQ8`) "parecia" ter o plano. Medido: **30 de 3.387 viam a
oferta** — justamente as que não tinham nada. As 699 melhores candidatas nunca viram.
Deveria esconder só de quem comprou o Completo.

**B. "Handify Completo" não existia como entidade.** Era um código em 23 cursos.
Sem campo, tabela ou função que dissesse "esta aluna tem o plano". Consequências:
renovação = 23 matrículas; revogar = 23 cliques; curso novo não entra sozinho;
admin não filtra "quem tem Completo"; dar o plano na mão = 23 checkboxes.

**C. `courses.is_subscription_only` existe e está morto** (nenhum curso usa). Foi
desenhado para "curso incluído na assinatura" e substituído pela gambiarra dos códigos.

### Regressão encontrada durante o levantamento (corrigida junto)

`process_pending_payment_events()` — rede de segurança que libera compras feitas
antes da conta existir — ainda citava `c.product_codes`, coluna que renomeei para
`checkout_codes` em 03/09. A função falhava em toda conta nova, com o erro engolido
por `raise warning` em `handle_new_user`. Zero eventos presos no momento (o webhook
em TS cobre o caminho principal via `activation_tokens`), mas estava furada.
Consertada na migration `20260903_memberships.sql`.

---

## 1. Princípio: tiers só adicionam

Nada que uma aluna tem hoje vai para trás de cadeado — calculadoras, fornecedores,
comunidade, nada. 3.300 pessoas pagaram por um estado da plataforma; mexer nele é
quebra de confiança. **O exclusivo do Completo é o que ainda não existe.**

| | **Visitante** (cadastro gratuito) | **Aluna** (curso avulso) | **Handify Completo** |
|---|---|---|---|
| Papel no negócio | Captar e nutrir até a 1ª compra | Onde está o dinheiro hoje | Onde está o LTV |
| Cursos | Prévias (1ª aula de cada módulo) | Os que comprou | Todos, inclusive futuros |
| Ferramentas | As que **criam a vontade** do curso | Todas as atuais | Atuais + exclusivas novas |
| Comunidade | Ler Avisos e ver a vida lá dentro | Tudo | Tudo + espaço próprio |
| Convite | "Comece com um curso" | "Você já tem 4 de 23" | Nenhum — chegou |

**Gratuito:** o critério não é "o que é barato dar", é **o que gera vontade do curso**.
Calculadora de Lucro é perfeita (mostra quanto poderia ganhar; o curso é o caminho).
Fornecedores completo, não (valor entregue sem porta para venda). Grátis mostra o
resultado; o curso ensina a chegar lá. Gratuito bom demais canibaliza curso de R$47.

**Exclusivo do Completo:** ferramentas de *negócio*, não de *receita*. As atuais
ajudam a fazer o produto; as exclusivas ajudam a vender e gerir: precificação de
catálogo inteiro, controle de pedidos/estoque, gerador de orçamento para cliente,
calendário sazonal (Natal, Dia das Mães) com receitas e prazos, certificado com selo.
"Sei fazer vela" → "tenho um negócio de velas". É isso que justifica R$327 sem que a
aluna de R$47 sinta que perdeu algo.

**Nomes na interface:** nunca "Gratuito"/"Avulso" (são nomes de tabela de preço).
Ela é *Aluna Handify* ou *Aluna Handify Completo*. O tier gratuito não precisa de
nome visível — precisa de um convite.

**Dúvida da Jessica, respondida:** "liberar todos os cursos não confundiria se é ou
não Completo?" — Não, porque a **membership** é a fonte da verdade, não a lista de
cursos. Uma aluna que comprou os 23 cursos separados NÃO é Completo (não tem
membership). A flag no curso diz só "este curso faz parte do pacote"; quem *é*
Completo é quem tem a linha em `memberships`.

---

## 2. Onde o LTV se move (UX) — aprovado pela Jessica

1. **Corrigir a barra.** Sozinho expõe a oferta a 3.300 alunas.
2. **Barra de progresso para o plano, não banner.** "Você já tem 4 de 23 cursos" no
   painel. Quem tem 4 cursos gastou ~R$300; o Completo custa R$327. É um passo, não
   uma compra nova.
3. **Cadeado que mostra, não que esconde.** Ferramenta exclusiva aparece na lista com
   resultado borrado/parcial e "Desbloqueie com o Handify Completo". Nunca
   "Bloqueado". Nunca sumir do menu.
4. **Momento certo.** Upgrade aparece quando ela acabou de ganhar algo: concluiu
   curso, baixou certificado, usou calculadora pela 3ª vez. Não no login.
5. **Segmento 699 primeiro.** Campanha só para elas ("você já tem 6, o Completo
   fecha os outros 17 por X").

---

## 3. Marca e comunidade — como os tiers fortalecem os dois

A pergunta certa não é "o que cada tier pode acessar", é **"quem cada tier se sente
sendo"**. Tier como identidade, não como catraca.

### Pertencimento visível, sem hierarquia hostil
- **Selo "Completo"** ao lado do nome no fórum, nos comentários e no perfil público —
  faixa tricolor pequena, não coroa dourada. Status visível gera aspiração; o tom
  Handify (acolhedora) decide se isso vira inveja ou vontade. Junto: "Aluna desde
  jul/2026" para *todas* — antiguidade é status que ninguém compra, e iguala.
- **Carteirinha digital** compartilhável ("Sou Aluna Handify Completo", primeiro
  nome, faixa tricolor, logo com ™) gerada na plataforma para postar no Instagram.
  Prova social orgânica + marketing gratuito + futura base para "indique uma amiga".
  Versão para Aluna também ("Aluna Handify") — todo mundo tem o que mostrar.
- **Certificado com selo do tier.** O certificado já é o artefato de marca mais
  compartilhado; o selo Completo é o diferencial visual sem tirar nada do outro.

### Uma comunidade, não duas
- **Não dividir o fórum.** Comunidade separada por tier mata a densidade — e a
  densidade é o que faz o fórum valer. O Completo ganha um **tipo de espaço** dentro
  da mesma comunidade ("Bastidores do negócio": preço, cliente, venda), não um
  fórum à parte. Aluna vê que existe e vê os títulos; entra quem tem o plano.
- **Visitante lê, não posta.** Ver a vida lá dentro (fotos de projetos, respostas da
  Jessica, alunas se ajudando) é a melhor página de vendas que existe. A ação
  "Quero participar" leva ao primeiro curso.
- **Aluna em Destaque** (já existe no feed) fica **inclusiva** — qualquer tier. É
  reconhecimento pelo *fazer*, não pelo *pagar*. O Completo ganha uma vitrine
  distinta: **"Negócio da Semana"** — o ateliê de uma aluna Completo apresentado
  como negócio (marca, produtos, onde compra). Reforça a promessa do tier.

### Rituais e co-criação
- **Encontro mensal do Completo** (live/gravado) — o ritual dá corpo ao "pertenço".
- **Completo vota no próximo curso** e tem acesso antecipado (1 semana). Co-criação é
  o cimento mais forte de comunidade e o argumento mais honesto de renovação anual.
- **Kit de boas-vindas digital** ao entrar no Completo: carta da Jessica, mapa do
  ateliê inteiro, carteirinha. Primeira impressão do tier = momento de marca.

### Voz
- "Desbloqueie", nunca "Bloqueado". "Você já tem X de 23", nunca "Faltam 19".
- O plano é **"o ateliê inteiro"**, não "acesso a tudo". Belonging, não access.
- Landing gratuita é a porta do ateliê aberta, não uma trial com relógio.

### O que medir
- % que posta no fórum, por tier (o selo aumenta participação do Completo?)
- Taxa de upgrade do segmento 4+ cursos após a barra "X de 23"
- Compartilhamentos da carteirinha (link rastreável)
- Renovação anual do Completo (co-criação e ritual devem mover isso)

---

## 4. Modelo de sistema

**Tabela `memberships`** (não um campo no perfil):
`id, user_id, plan ('completo'), source (payt|kiwify|manual|bonus|migration),
granted_at, expires_at, revoked_at, granted_by, reason, created_at`.
Uma ativa por plano por aluna (índice único parcial em `revoked_at is null`).
Histórico preservado (revogar = marcar `revoked_at`, não apagar).

**Tier nunca é armazenado — é derivado** numa função só, em dois lugares que devem
concordar (espelha `hasCourseAccess` / `is_enrolled`):
- SQL: `public.current_tier()` → `visitante | aluna | completo | admin`
- TS: `getTier()` em `src/lib/auth/access.ts`
Completo = membership ativa; Aluna = alguma matrícula ativa; Visitante = nada.

**Matrícula continua por curso** — é dela que saem progresso, conclusão e
certificado. O plano é *o motivo* das matrículas, não o substituto.

**Como a membership nasce:**
- Webhook (Payt/Kiwify), aluna com conta → `process-purchase.ts` insere.
- Webhook, aluna sem conta → `activation_tokens` como hoje; quando a conta nasce,
  `handle_new_user` → `process_pending_payment_events` → `sync_membership_from_payments`
  cria a membership a partir do `payment_events` (uma implementação para os 5
  caminhos de ativação que existem).
- Admin → "Dar Handify Completo" na ficha (motivo + validade opcional) → membership
  `manual`/`bonus` + matrículas nos cursos do plano + `audit_log`.
- Reembolso/cancelamento do plano → webhook marca `revoked_at` (matrículas já são
  revogadas pelos códigos, como hoje).
- Revogação manual → `revoked_at` + expira as matrículas concedidas *naquela* ação
  (mesmo `granted_at`), sem tocar em cursos comprados separadamente.

**Curso novo entra no plano sozinho (fase 3):** `courses.incluido_no_plano`
(o `is_subscription_only` renascido) → grant do plano matricula em todos os cursos
com a flag; deixa de precisar colar o código do plano em cada curso novo.

**Menu por tier sem deploy (fase 3):** `menu_items.visible_to` de
`guest|student|admin` para `visitante|aluna|completo|admin`. `guest` hoje é letra
morta (tudo exige login).

**Ferramentas saem do código (fase 3):** tabela `tools` com `tier_minimo`, em vez do
array hardcoded em `FerramentasHub.tsx`. Princípio backend-first do CLAUDE.md.

### Armadilhas
- **Detectar plano por pagamento** classificaria errado as 931 matrículas migradas
  (sem `payment_events`). Por isso a tabela própria.
- **Plano só na Payt.** Os códigos do Completo não incluem produto Kiwify. Vender lá
  sem cadastrar o `product_id` não libera nada.
- **Tiers antes de corrigir a barra** = vitrine antes de abrir a porta.

---

## 5. Execução

### Fase 1 — Alicerce (feita em 03/09, aguardando push)
- [x] Migration `20260903_memberships.sql`: conserta `process_pending_payment_events`
      (`checkout_codes`), cria `memberships` + RLS + `has_active_membership()` +
      `current_tier()` + `is_plan_code()` + `sync_membership_from_payments()`,
      liga a sync ao `process_pending_payment_events`, backfill
- [x] Backfill: **50 memberships** (não 58 — 8 compradoras têm `canceled`/`chargeback`
      depois do `paid`, e a regra "compra não desfeita" as excluiu, corretamente)
- [x] `access.ts`: `hasActiveMembership()` e `getTier()`
- [x] `process-purchase.ts`: compra do plano → membership; reembolso → `revoked_at`
- [x] Layout: barra "Seja Premium" esconde só de quem tem membership ativa (**o bug**).
      Verificado no localhost: conta com cursos e sem plano voltou a ver a barra
- [x] Admin ficha da aluna: card "Handify Completo" com status, **Dar** (motivo +
      origem manual/bônus + validade) e **Revogar** (motivo), `audit_log`, selo no
      cabeçalho. Verificado por tsc + build; não cliquei (sessão do navegador não é admin)
- [x] Build, testes, commit (sem push até a Jessica mandar)

**Achado durante a fase 1 — decidir com a Jessica:**
- [ ] **7 alunas cancelaram o plano e continuam com os 23 cursos.** `payt.ts` só
      revoga em `refunded`/`chargeback`; `canceled` cai em "ignore" porque foi assumido
      como "PIX abandonado antes de pagar". Mas a Payt usa `canceled` também para
      reembolso concluído (`paid → refund_requested → canceled`). As de `chargeback`
      foram revogadas (0 cursos); as de `canceled` não (23 cursos cada, R$327 devolvido).
      Correção proposta: `canceled` revoga **só se houver `paid` anterior** para o
      mesmo e-mail + código (não toca no PIX abandonado). Retroativo nas 7 = mexer em
      dados de alunas reais → só com o "pode" dela.

### Fase 2 — Expor a oferta
- [ ] Barra de progresso "Você já tem X de 23" no dashboard
- [ ] Momento certo: convite ao concluir curso / baixar certificado
- [ ] Filtro "Completo" e coluna na lista de alunas; export CSV com tier
- [ ] Campanha segmento 699 (e-mail via Resend, template Handify)

### Fase 3 — Tiers no banco
- [ ] `courses.incluido_no_plano`; grant do plano usa a flag
- [ ] `menu_items.visible_to` por tier
- [ ] Tabela `tools` com `tier_minimo`; hub lê do banco; cadeado que mostra
- [ ] `current_tier()` nas policies do que for exclusivo

### Fase 4 — Porta aberta
- [ ] Landing pública `/comecar` (proposta do gratuito) + onboarding direto para a
      ferramenta grátis
- [ ] Visitante lê comunidade/Avisos sem postar

### Fase 5 — Marca e comunidade
- [ ] Selo "Completo" + "Aluna desde" no fórum/perfil
- [ ] Carteirinha digital compartilhável (com ™, faixa tricolor)
- [ ] Espaço "Bastidores do negócio" dentro do fórum
- [ ] "Negócio da Semana" no feed
- [ ] Kit de boas-vindas do Completo; votação do próximo curso; acesso antecipado

### Fase 6 — Primeira ferramenta exclusiva
- [ ] Escolher entre: precificação de catálogo · pedidos/estoque · orçamento para
      cliente · calendário sazonal. Critério: a que mais "vende" o Completo na tela.
