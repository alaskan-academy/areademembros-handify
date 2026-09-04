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
      cabeçalho. Verificado com clique (sessão admin): aluna com plano mostra selo +
      "Ativo · Desde 17/07/2026 · origem Payt" + Revogar; sem plano, "Não tem" + Dar
- [x] **Prova viva do caminho "sem conta ainda":** aluna comprou o plano em 02/09,
      criou a conta em 03/09 18:39 e a membership nasceu sozinha no mesmo minuto via
      `handle_new_user → process_pending_payment_events → sync` (50 → 51)
- [x] Build, testes, commit (sem push até a Jessica mandar)

**Achado durante a fase 1 — corrigido com autorização da Jessica (03/09):**
- [x] **Alunas que cancelaram o plano continuavam com os 23 cursos.** `payt.ts` só
      revogava em `refunded`/`chargeback`; `canceled` caía em "ignore" porque foi
      assumido como "PIX abandonado antes de pagar". Mas a Payt usa `canceled` também
      para reembolso concluído (`paid → refund_requested → canceled`).
      - **Código:** `canceled` vira `revoke_if_paid`; `processPurchaseEvent` resolve
        olhando se houve pagamento aprovado do mesmo e-mail para esses códigos —
        revoga se sim, ignora se não (PIX abandonado segue intocado). Teste e2e novo.
      - **Retroativo:** eram **6**, não 7 — a 7ª (`anamaria…`) pagou o plano *depois*
        dos `canceled` (PIX abandonados) e tem o plano de direito; a simulação a
        excluiu. Nas 6: **129 matrículas encerradas** (22+22+19+22+22+22), 129 linhas
        em `audit_log` (`enrollment.revoked`, `retroativo: true`). Cada uma ficou só
        com o que comprou separado (Saponaria, Lembrancinha; Helena com 4). Sem e-mail
        — reembolso foi semanas atrás, elas sabem.

### Fase 2 — Expor a oferta (em andamento, 03/09)
- [x] Card "Você já tem X de 23" no dashboard (`PlanProgressCard`): só para quem
      não tem membership e já tem ≥1 curso do plano (quem tem zero vê a barra do
      header). Copy Handify ("abre os outros N", nunca "faltam"), barra de progresso,
      CTA para o `link_url` da promo. Previsto: **3.317 alunas** veriam; a conta de
      teste veria "9 de 23". Verificado por tsc + build; a sessão do navegador era a
      admin (X=0 → oculto, como desenhado) — o visual real é na conta de aluna
- [x] Momento certo: o mesmo card, compacto, na página do curso quando está 100%
      ("Curso concluído! Você já tem X de 23…") e em Meus certificados quando há
      certificado ("Certificado na mão — e você já tem…"). Cálculo único em
      `src/lib/promo/plano-progresso.ts` para os três lugares nunca divergirem.
      Texto ajustado a pedido da Jessica: "cursos **da Handify**" (não "do ateliê").
      Verificado por tsc + build; a sessão do navegador é admin (sem progresso →
      oculto), o visual real é na conta de aluna
- [x] Lista de alunas: coluna "Plano" com pill Completo + chip-filtro
      `?plano=completo` (mostra a contagem; sem paginação, cabe numa página).
      Verificado com clique: 51 linhas, 51 pills. CSV: coluna "Handify Completo"
      (Sim/Não) antes de "Status" — verificado no download
- [x] **Sem cadastro** também: coluna "Plano" e o mesmo filtro. Sem conta não há
      membership, então o sinal vem de `payment_events` (pago com código do plano,
      sem reembolso depois — mesma regra da sync). 13 compradoras do plano ainda
      sem conta. Chip preserva a aba e mostra a contagem da aba
- [x] **Regressão corrigida no caminho:** a aba "Sem cadastro" não renderizava
      nada sem busca — o bloco estava *dentro* da condicional da aba "Cadastradas"
      desde a busca unificada de 03/09 (já em produção). Movido para fora;
      verificado: 480 linhas na aba, e a busca unificada segue mostrando as duas
- [x] **Admin → Alunas em três situações** (pedido da Jessica, 03/09): Cadastradas
      (comprou e ativou: conta + curso) · Sem ativação (comprou, não criou conta)
      · Sem cursos (só se cadastrou, não comprou — 30 hoje, antes invisíveis no meio
      de "Cadastradas"). View `admin_alunas_view` (security_invoker) entrega
      `qtd_cursos`, `tem_curso`, `tem_completo` calculados no banco → paginar,
      contar e filtrar sem listas de ids; o filtro Completo voltou a paginar.
      **Um campo de busca só** — o segundo (dentro de Sem cadastro) foi removido.
      Links de paginação preservam aba e filtro. `tab=sem-cadastro` (nome antigo)
      continua funcionando. Verificado com clique nas três abas, na busca e no filtro
- [~] Campanha segmento 699: template `renderPlanUpgradeEmail` /
      `sendPlanUpgradeEmail` pronto em `src/lib/email/index.ts`, preview gerado por
      `scripts/preview-email-completo.ts` e mostrado à Jessica. **Decisão dela:
      enviar só depois das ferramentas exclusivas (fase 6), para o e-mail já
      mostrá-las.** Nada configurado, nada enviado. Ao retomar: filtrar por
      `email_prefs`, segmento 4+ cursos sem membership, e ela aprova o texto final

### Fase 3 — Tiers no banco (em andamento, 03/09)
- [x] **`courses.in_plan`** (o `is_subscription_only` renomeado — nenhum curso o
      usava). Backfill: 23 cursos (só "Velas Perfeitas" fica fora). Checkbox no
      admin do curso: "Incluído no Handify Completo".
      - Acesso: `is_enrolled()` (SQL) e `hasCourseAccess()` (TS) aceitam
        *membership ativa + curso in_plan* mesmo sem matrícula — curso novo marcado
        entra na hora para quem tem o plano. O TS cria a matrícula no primeiro acesso
        (`source: subscription`), porque progresso e certificado saem dela.
      - Compra do plano (webhook e `process_pending_payment_events`) matricula em
        todos os `in_plan`, inclusive os sem o código do plano nos checkout_codes.
      - "Dar Handify Completo" e o card "X de 23" passam a contar pela flag.
      - Verificado: tsc/build, funções no banco citam `in_plan`, /admin/cursos abre
- [x] **`menu_items.visible_to` por tier**: enum ganhou `visitante | aluna |
      completo`; `guest` e `student` viraram `visitante` (tiers só adicionam — ninguém
      perdeu item). Layout deriva o tier (`getTier`) e o nav mostra os itens do tier
      e dos de baixo; `admin` segue sendo papel. Formulário do admin com os nomes
      novos. Verificado: /cursos com os 9 itens, /admin/menu sem guest/student
- [x] **Ferramentas no banco, por tier e por categoria** (proposta v2 aprovada em 03/09,
      artefato "Ferramentas por Tier"). Tabelas `tools` + `tool_categories`; regra:
      visitante = qualquer conta · aluna = membership OU matrícula em curso de uma das
      categorias da ferramenta (sem categoria = qualquer curso) · completo = membership.
      `src/lib/ferramentas/access.ts` (`getToolsForViewer`, `assertToolAccess`) espelha a
      regra; as 4 páginas de ferramenta chamam a trava (sem ela o cadeado seria só
      cosmético). Hub novo: "Seus artesanatos" derivado dos cursos, abas Calcular ·
      Guardar · Fornecedores, cadeado que mostra o preview borrado e o caminho, busca
      única, primeira ferramenta visível sem rolar no celular. Admin em
      `/admin/ferramentas` ("Ferramentas e tiers") edita tier, categorias, grupo, ordem,
      em breve, ativa — sem deploy. 12 ferramentas semeadas (6 calcular, 1 fornecedores,
      5 guardar em breve). Verificado com clique (sessão admin): hub, admin e trava.
      **Jessica revisa o mapeamento no painel** — proposta atual: Essências ← Saboaria,
      Velas, Aromas, Cosméticos · Pavio ← Velas · Rótulo ← Saboaria, Cosméticos.
- [ ] `current_tier()` nas policies do que for exclusivo (quando as ferramentas
      "Guardar" tiverem tabelas próprias)
- [ ] Nome da seção: **"Ferramentas"** (mantido); bloco do Completo: **"Meu negócio"**
- [x] **"Minha receita" como fluxo** (`/ferramentas/minha-receita`): Produto →
      Ingredientes (com escala de lote) → Essências → Pavio (só velas) → Custo e preço
      → Ficha. Matemática extraída para `src/lib/ferramentas/calc.ts` com **19 testes
      unitários** (vitest, `npm test`) conferidos na mão. Etapas de aluna obedecem à
      tabela `tools` (trancadas mostram o caminho e deixam pular). Rascunho no
      aparelho; "Salvar neste aparelho"; "Guardar na conta" aponta para o Completo
      (Minhas receitas, em breve). Porta "O que você precisa agora?" no hub com os
      botões que existem (2 hoje; os outros 2 aparecem quando Deu problema? e Meta
      de renda existirem). As três calculadoras antigas continuam nas rotas (etapa
      sozinha) mas saem da lista (`tools.show_in_hub`, editável no admin).
      **Verificado ponta a ponta no navegador, preenchendo e conferindo na mão:**
      sabonete 20×90 g → matéria-prima R$ 63,00 · escalar 20→50 (1800→4500) e volta ·
      essência 36 mL/36 g/720 gotas · custo R$ 6,61 · preço R$ 11,01 · lucro R$ 4,41 ·
      lote R$ 220,25/R$ 88,10 · salvar OK; vela 10×200 g → 200 mL/4000 gotas · pavio
      LX 12 (alt. CD 12, ECO 4) com fragrância sugerida da etapa anterior · custo
      R$ 14,70 · preço R$ 24,50 · lucro R$ 9,80. Calculadora de essências antiga
      também conferida (36/36/720). Sessão do navegador é admin: etapas trancadas
      verificadas por tipo e lógica

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

### Fase 6 — Ferramentas exclusivas do Completo ("Guardar")
- [x] **Minhas receitas** (`/ferramentas/minhas-receitas`, 03/09): a ficha de "Minha
      receita" guardada na conta. Tabela `recipes` com resumo (custo, preço, margem,
      aroma, pavio) + o formulário inteiro em jsonb (reabre como estava). **"Nunca
      some, só congela" no RLS**: a dona sempre lê; criar/editar/apagar exige
      membership ativa — plano vencido vê a lista em modo leitura com o convite de
      renovar. Na ficha: "Guardar na conta" → vira "Atualizar em Minhas receitas" +
      link. Abrir pela URL (`?receita=id`, só a dona). Verificado ponta a ponta com a
      sessão admin: guardar (toast), listar (nome, 10 velas de 200 g, custo/preço/
      margem, essência = pavio A2025), abrir na Ficha, apagar com confirmação → 0 no
      banco. **Achado no teste: hora de trabalho negativa virava desconto no custo**
      — bloqueado na tela (`min=0`, parse ≥ 0) e no cálculo (`pos()`), com teste (26).
- [x] **Catálogo e tabela de preços (PDF)** (`/ferramentas/catalogo`, 03/09): a
      vitrine do plano, com a marca dela. Tabelas `business_profile` (nome, frase,
      WhatsApp, Instagram, cidade — vai no topo do PDF e depois serve rótulos e
      orçamentos) e `catalog_items` (produto, descrição, preço, "entra no PDF",
      `recipe_id` opcional). Produto pode nascer de uma receita guardada: nome e
      preço vêm preenchidos; o card mostra "custo R$ x = margem de y%" e, quando a
      receita muda, "a receita sugere R$ z — Aplicar". PDF em `pdf-lib` (A4, faixa
      tricolor, marca dela grande, "feito com Handify™" só no rodapé, ~20 KB —
      trocado o `icon.png` de 636 KB pelo de 192 px), servido por
      `/api/ferramentas/catalogo/pdf` (checa sessão; `/api` é público no proxy).
      Mesmo RLS "congela": dona sempre lê e gera o PDF; escrever exige membership.
      Verificado ponta a ponta com a sessão admin: marca salva, produto manual,
      produto da receita (R$ 6,61 de custo em R$ 11,01 = 40%; após mudar a receita
      para R$ 12,50, "Aplicar" → 47%), editar preço, tirar do PDF (contador 2 → 1),
      apagar com confirmação; PDF 200/application/pdf; insert como aluna sem plano
      → "violates row-level security". Aqui o e-mail da campanha passa a valer
- [x] **Pedidos e clientes** (`/ferramentas/pedidos`, 03/09): quem pediu o que,
      para quando, quanto falta receber. Tabelas `customers` (nome único por aluna
      sem diferenciar maiúsculas + WhatsApp), `orders` (status a fazer → pronto →
      entregue, data de entrega, `paid_amount` = quanto já recebeu; "sinal" e "pago"
      são derivados, não guardados) e `order_items` (do catálogo ou digitado; nome
      e preço copiados para pedido antigo não mudar com o catálogo). Tela: resumo
      "Em aberto N = R$" e "A receber R$" (+ atrasados em vermelho ou entregas até
      domingo), abas Abertos / Entregues / Clientes, formulário com datalist de
      clientes (preenche o WhatsApp), itens do catálogo com preço, total ao vivo;
      no card os atalhos "Ficou pronto", "Entregue", "Recebi tudo" e o link
      wa.me. Mesmo RLS "congela". Verificado ponta a ponta com a sessão admin:
      2 velas + 1 sabonete = R$ 111,80 com sinal R$ 30 = faltam R$ 81,80,
      "Entrega sábado"; pronto → pago → entregue (aba Entregues); pedido atrasado
      ("Atrasado há 2 dias", 3 × 32 = R$ 96,00, "1 atrasado"); "ana souza" em
      minúsculas reaproveita a cliente (sem duplicar) e mantém "Ana Souza";
      apagar com confirmação; insert como aluna sem plano → RLS bloqueia.
- [x] **Rótulo do produto** (`/ferramentas/rotulo`, 03/09, tier aluna;
      sabonete/cosmético com Saboaria/Cosméticos, vela com Velas/Aromas — a
      família dentro da ferramenta segue o curso, como na Validade). Sem banco:
      ela preenche (marca, produto, o que é, conteúdo, ingredientes ou
      composição, modo de uso/como usar e advertências/avisos de segurança já
      escritos — ANVISA para cosmético, segurança de queima para vela —,
      fabricação/validade/lote, quem fabrica, CNPJ opcional, contato), vê a
      prévia na hora e baixa a folha A4 em PDF. **Aparência (pedido da Jessica,
      "ficou feio")**: 3 estilos (Clássico = moldura dupla e nome em serifa;
      Moderno = faixa colorida no topo; Delicado = fundo suave e divisória com
      ponto), 8 cores + cor livre, forma retangular ou redonda, **tamanho
      livre** em cm (presets Mini 7×4, Barra 9×5, Pote 9×7, Tampa 5 e 7 cm;
      limites da folha A4) com "cabem N por folha" ao vivo; marca em caixa alta
      espaçada, nome grande, na redonda cada linha respeita a largura do círculo;
      letra encolhe até caber; borda fina de corte. "Copiar o texto do
      rótulo". Checklist do que a ANVISA pede marcando o que já está preenchido
      + aviso sobre "hipoalergênico / natural / orgânico" sem certificado e
      sobre notificação na ANVISA. Botão **"Não sei a validade — calcular"** →
      Validade com `?voltar=rotulo` → "Usar no rótulo" volta com fabricação,
      validade e lote; o resto fica no rascunho do aparelho. Quem tem a marca no
      Catálogo entra com marca/fabricante/contato preenchidos. PDF por POST de
      formulário (`/api/ferramentas/rotulo/pdf`, checa sessão e acesso da
      ferramenta). Verificado: PDF 200 e legível nos 3 tamanhos; ida e volta
      com a Validade mantendo marca e produto digitados.
- [x] **Estoque de insumos** (`/ferramentas/estoque`, 04/09, Completo). Tabela
      `supplies`: nome, categoria (cera, base, óleo, essência, corante, aditivo,
      embalagem, pavio, outros), quantidade + unidade (g/kg/mL/L/un), mínimo
      ("avisar abaixo de"), validade da embalagem, "paguei R$ x por y" (custo
      por 100 g/mL ou por kg/L/un derivado), fornecedor, observação. Tela:
      resumo Acabando / Vencendo (30 dias ou vencido) que também filtra, chips
      por categoria, atalhos **Usei** e **Comprei** no card (nunca abaixo de
      zero), editar, apagar. **Alimenta a Validade**: "Puxar do estoque" lista
      os insumos com data — o que vence primeiro manda. Mesmo RLS "congela".
      Verificado: 1200 g = "1,2 kg", R$ 45/1000 g = "R$ 4,50 por 100 g", usei
      1000 → 200 g "Acabando" (mínimo 300), comprei 1000 → 1,2 kg, item zerado e
      vencido → "Acabou" + "Venceu há 34 dias", e na Validade o insumo puxado
      virou o limite (16 dias).
- [x] **Pontes entre ferramentas — bloco 1, a ficha da receita como centro**
      (04/09, pedido da Jessica: "como fizemos com a validade no rótulo"):
      Ingredientes ← Estoque ("Puxar do estoque" traz nome, unidade e o custo
      real: paguei R$ x por y); Ficha → "Dar baixa no estoque (N)" desconta o que
      usou no lote (converte g↔kg, mL↔L); Ficha → "Até quando dura?" abre a
      Validade com o tipo e os insumos com data, e "Usar na receita" volta com a
      data na ficha; Ficha → "Fazer o rótulo" leva nome, peso, ingredientes e
      validade; Ficha → "Pôr no catálogo" (receita guardada) abre o produto com
      nome e preço sugerido. Verificado ponta a ponta: 1800 g de base a R$ 45/kg
      = R$ 81,00; baixa 2000 → 200 g; validade limitada pela base (6 meses =
      01/03/2027); rótulo e catálogo (R$ 7,09) preenchidos.
- [ ] Pontes — bloco 2 (pequenas): Essências → Estoque ("você tem 20 mL —
      faltam 16"); Qual pavio → Fornecedores ("onde comprar"); Pedidos →
      Catálogo (item digitado vira produto).
- [ ] Pontes — bloco 3 (com "Meu negócio"): Pedidos → Produzir (soma o que está
      em aberto, escala a receita ligada, confere contra o estoque: "faltam
      400 g de base").
- [ ] Calendário do artesanato
- [x] **Validade do produto** (`/ferramentas/validade`, 03/09, tier aluna, aba
      Calcular, categorias Saboaria/Cosméticos/Velas/Aromas; porta "Que validade
      pôr no rótulo?" no hub). Lógica pura em `src/lib/ferramentas/validade.ts`
      com 15 testes: tipo do produto (glicerinado, cold process, líquido, sem
      água, com água, vela), data (cold process = fim da cura), conservante
      (nenhum/sintético/natural/não sei + prazo do fabricante, teto 6 meses),
      óleos frágeis, fresco, antioxidante (6 → 9, 12 → 18), aroma, embalagem,
      lista de insumos com data ("o que vence primeiro manda"; vencido = perigo).
      Saída: "9 meses = vence em 03/06/2027", o que limita, alertas (perigo /
      atenção / dica, incluindo oxidação e "antioxidante não é conservante"),
      sugestões de aditivo pelo problema (natural + sintético, dose, pH) e texto
      do rótulo com lote sugerido + copiar. Verificado na tela: com água sem
      conservante = 7 dias; sintético 3 meses = 03/12/2026; cold process + óleo
      frágil + antioxidante = 9 meses; insumo 15/01/2027 vira o limite.
      **Pendente:** professora de saboaria valida a tabela antes do push.
      **Dentro da ferramenta segue o curso (03/09):** `getToolsForViewer()` passou a
      devolver `categorias` (slugs dos cursos dela) e `assertToolAccess()` devolve os
      dados. Tipos por curso: Saboaria = glicerinado, cold process, líquido;
      Cosméticos = sem água, com água, líquido; Velas = vela; Aromas e Casa = vela,
      com água, sem água; Completo/admin = tudo. Tipo fora do curso fica visível,
      tracejado, com cadeado e "Com o curso de X" → /cursos. Verificado simulando
      aluna só de Velas (5 travados, Vela aberto) e admin (6 abertos).

**Revisão das outras ferramentas (03/09) — o que varia por curso:**
- Calculadora de essências: a URL `/sabonetes` ou `/velas` agora obedece ao
  curso (aluna só de Velas que abre `/sabonetes` vai parar em `/velas`;
  `produtosLiberados()` em `src/lib/ferramentas/produtos.ts`, com testes).
- Minha receita: custo e preço são gratuitos (visitante), então sabonete e
  vela continuam abertos para todas; agora **começa** no produto do curso dela
  (`produtoPadrao`). As etapas Essências e Pavio já obedeciam à categoria.
- Calculadora de lucro: gratuita, os dois produtos abertos — de propósito.
- Qual pavio usar: só Velas (já era).
- [ ] **Revisar Fornecedores** (pedido da Jessica, 03/09): hoje abre com
  qualquer curso e lista todos os nichos com conteúdo. Decidir se filtra pelos
  nichos dela (Completo vê todos) e se entra em tool_categories.
- Catálogo, Pedidos, Minhas receitas: Completo, sem variação por nicho.
- [ ] Bloco "Meu negócio" no topo de Ferramentas para o Completo (quando houver
      receitas/pedidos para resumir)

### Proposta — Validade do produto (ideia da Jessica, 03/09)

**Dor real:** muita aluna não sabe que validade pôr no rótulo (e o rótulo exige).
Chutar é arriscado nos dois sentidos: curto demais perde venda, longo demais
entrega produto rançoso ou, pior, com água sem conservante.

**Como calcular (regra do ingrediente que vence primeiro):**
1. A validade do produto nunca passa da validade **restante** do ingrediente
   que vence primeiro (base glicerinada que vence em 6 meses = sabonete vence
   em 6 meses, mesmo que o resto dure 2 anos).
2. Produto **com água** (sabonete líquido, hidratante, tônico) e **sem
   conservante** = 7 dias na geladeira, e a ferramenta avisa em vermelho.
   Com conservante = o prazo que o fabricante do conservante indica
   (normalmente 3 a 6 meses).
3. Ingrediente **fresco** (fruta, leite, ervas in natura) = puxa para 7 dias
   sem conservante.
4. **Cold process** conta a partir do fim da cura (4 a 6 semanas); o limite é
   o óleo que rancifica mais rápido (girassol e uva ≈ 6 meses, oliva/coco ≈
   12 a 24 meses); vitamina E / extrato de alecrim alongam.
5. **Glicerinado (melt & pour)**: 6 a 12 meses, embalado (plástico filme evita
   "suar"); óleo essencial encurta mais que essência sintética.
6. **Vela**: a cera não vence; o aroma enfraquece ≈ 12 meses → "melhor até".
7. Guardar em lugar seco, fresco e sem sol — a ferramenta lembra isso no
   resultado.

**Saída:** "Validade estimada: 6 meses = vence em 03/03/2027", o motivo ("o que
limita: a base glicerinada"), o texto pronto para o rótulo ("Fabricação
03/09/2026 | Validade 03/03/2027 | Lote 0926-01") e o aviso honesto: é uma
estimativa para planejar e etiquetar; para vender em escala ou registrar, o
teste de estabilidade é que define. Tabela de referência: eu redijo, a
professora de saboaria valida (é matéria de segurança).

**Onde encaixa (sem picar informação):**
- Card próprio no hub, aba Calcular ("Validade do produto") — é o que a aluna
  procura pelo nome.
- Etapa opcional em "Minha receita" para sabonetes/cosméticos ("Até quando
  dura?"), com os ingredientes já digitados.
- Alimenta "Rótulo do sabonete" (validade + lote) e usa "Estoque de insumos"
  (validade de cada insumo já cadastrada = cálculo automático).

**Tier sugerido:** **aluna** (com curso de Saboaria ou Cosméticos), não
gratuito: é conhecimento que o curso ensina e tem risco se usado sem base
(água sem conservante). No **Completo**: guardar a validade por receita, puxar
do estoque, imprimir no rótulo e avisar "o lote X vence em 15 dias".

**Aditivos (pedido da Jessica, 03/09) — a ferramenta sugere, não prescreve:**

Dois grupos que a aluna costuma confundir. **Antioxidante** segura a rancificação
do óleo (oxidação); **conservante** segura micróbio, e só faz sentido onde tem
água. Vitamina E e extrato de semente de toranja **não conservam** contra
micróbio — erro comum que a ferramenta corrige em texto.

| Aditivo | Tipo | Para quê | Dose usual (% sobre o peso da receita) | Observação |
|---|---|---|---|---|
| Vitamina E (tocoferol / acetato de tocoferila) | natural | antioxidante — óleos, manteigas, cold process, glicerinado com óleos | 0,1 a 0,5% | não é conservante |
| Extrato de alecrim (ROE) | natural | antioxidante forte | 0,05 a 0,1% | cheiro herbal leve |
| BHT | sintético | antioxidante | 0,01 a 0,1% | barato, muito vendido em loja de saboaria |
| EDTA dissódico | sintético | sequestrante — ajuda contra pontos laranja (DOS) no cold process, melhora espuma em água dura | 0,1 a 0,2% | dissolver na água da soda |
| Fenoxietanol + etilhexilglicerina (Euxyl PE 9010 e similares) | sintético | conservante amplo espectro | 0,5 a 1% | pH 3 a 12 — o mais usado; escolha padrão quando tem água |
| Fenoxietanol + caprilil glicol (Optiphen e similares) | sintético | conservante amplo espectro | 0,5 a 1,5% | sem parabeno |
| Ácido desidroacético + álcool benzílico (Geogard 221 / Sharomix / Cosgard) | aceito em cosmética natural | conservante amplo espectro | 0,5 a 1% | só pH até 6 |
| Sorbato de potássio + benzoato de sódio | natural | conservante | 0,1 a 0,5% cada | só pH abaixo de 5,5; fraco sozinho |
| Naticide / Ecogard | natural (à base de fragrância) | conservante | 0,3 a 1% | tem cheiro próprio |
| Parabenos (metil/propilparabeno, "Nipagin/Nipazol") | sintético | conservante | 0,1 a 0,3% | permitido pela ANVISA nos limites, mas cliente rejeita — a ferramenta cita, não recomenda |
| Metilisotiazolinona (Kathon CG) | sintético | conservante | — | sensibilizante, restrito em produto que fica na pele — a ferramenta diz "evite" |

**Aviso de oxidação (rancificação) que a ferramenta mostra:** sinais = cheiro de
óleo velho, pontos laranja no cold process, escurecimento; causas = óleos com
muito linoleico (girassol, uva, cânhamo, linhaça), calor, luz, metais da água,
óleo já perto de vencer; prevenção = antioxidante + sequestrante no cold
process, embalagem fechada, lugar seco e escuro, insumo novo (a validade do
óleo é a do produto).

**Cuidado ao sugerir aditivo (regras da ferramenta):**
1. Sugere pelo tipo do produto e pelo problema (água sem conservante → conservante;
   óleos frágeis → antioxidante), sempre com a faixa de dose e "confira a faixa
   do fabricante do seu insumo".
2. Mostra sempre uma opção natural e uma sintética, com o que muda (pH, cheiro,
   custo).
3. Alerta de compatibilidade: sorbato/benzoato e Geogard só em pH ácido; EDTA no
   cold process vai na água da soda; conservante não substitui ingrediente
   fresco (fruta e leite continuam a 7 dias).
4. Efeito na validade é explícito e conservador: antioxidante alonga o limite
   do óleo (6 → 9 meses, 12 → 18), nunca passa da validade do insumo; produto
   com água e conservante = prazo que o fabricante do conservante indica
   (padrão 3 meses, máximo 6 sem teste de estabilidade).
5. Sempre fecha com: "estimativa para planejar e etiquetar; para vender em
   escala ou registrar, teste de estabilidade". Tabela validada pela professora
   de saboaria antes de ir ao ar.

**Ordem decidida (03/09):** Validade primeiro, como ferramenta própria (aba
Calcular, tier aluna, categorias Saboaria/Cosméticos/Velas/Aromas). Depois o
Rótulo do sabonete nasce com o campo de validade e o botão "Não sei a
validade → calcular", que abre a Validade e volta com o valor preenchido.
