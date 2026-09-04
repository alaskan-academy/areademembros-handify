# Fornecedores — revisão de UX, UI e sistema

> Levantado em 04/09/2026 a pedido da Jessica. **Nada foi executado.** Este
> arquivo guarda o diagnóstico e as ideias para quando for a hora.
>
> Contexto do produto e dos tiers: [tiers-handify.md](tiers-handify.md).

## Onde a área está hoje

**Arquivos** (2.541 linhas no total)

| Arquivo | Linhas |
|---|---|
| `src/components/ferramentas/fornecedores/FornecedoresPage.tsx` | 455 |
| `src/components/ferramentas/fornecedores/SupplierForm.tsx` | 442 |
| `src/components/ferramentas/fornecedores/ProdutoForm.tsx` | 310 |
| `src/components/ferramentas/fornecedores/FornecedorCard.tsx` | 194 |
| `src/components/ferramentas/fornecedores/SugestaoModal.tsx` | 167 |
| `src/components/ferramentas/fornecedores/ReviewsModal.tsx` | 134 |
| `src/components/ferramentas/fornecedores/MaterialCard.tsx` | 50 |
| `src/components/ferramentas/fornecedores/NichePills.tsx` | 44 |
| `src/lib/fornecedores/actions.ts` | 529 |
| `src/lib/fornecedores/types.ts` | 129 |
| `src/app/(student)/ferramentas/fornecedores/page.tsx` | 87 |

**Dados reais no banco (04/09)**

| Coisa | Quantidade |
|---|---|
| Lojas ativas | 46 (29 verificadas) |
| Materiais | 17 (todos com link de compra e ligados a curso) |
| Canais de venda cadastrados | 101 |
| Tags | 128 |
| Links material → loja | 97 |
| Links loja → nicho | 77 |
| Favoritos | 81, de **10 alunas** |
| **Avaliações de loja** | **0** |
| **Avaliações de material** | **0** |
| Sugestões de fornecedor | 3 |
| Nichos mapeados | **2** (saboaria e velas) |

## Diagnóstico

### 1. O problema maior é o momento, não o visual
Fornecedores é uma ilha. A aluna só chega se lembrar de clicar. Mas a vontade
de comprar não nasce ali: nasce quando o Estoque mostra a base acabando, ou
quando o Produzir diz que faltam 1.600 g para o pedido de sexta. **Esses dois
lugares não levam a lugar nenhum hoje.** Já existem pontes de Pavio e de
Essências para cá; falta a que importa.

### 2. A tela responde a uma pergunta que a aluna não faz
Duas abas, "Materiais" e "Lojas e Marcas", mostram o mesmo acervo por dois
eixos. Ela não pensa "quero ver lojas", pensa "preciso de cera de soja".
A aba Lojas é a visão de quem administra o catálogo, exposta para quem só
quer comprar.

### 3. Falta o dado que decide a compra
Não há preço, prazo, nem de onde a loja envia. Frete é a variável número um
para quem mora longe do Sudeste. Do jeito que está, ela abre os quatro sites
de qualquer forma — a tela não poupa trabalho nenhum.

### 4. A prova social está invertida
Todo card diz "Seja a primeira a comentar". São 46 lojas repetindo um vazio, e
em meses **ninguém comentou** (0 linhas nas duas tabelas de review). Enquanto
isso existe sinal de verdade escondido: **81 favoritos de 10 alunas**. O card
devia mostrar o que aconteceu, não convidar para um formulário que não pega.

### 5. Só dois nichos estão mapeados
Quem fez Cosméticos ou Aromas cai numa lista pensada para saboaria e velas.
Degrada com elegância por causa do mapa de categoria → nicho, mas não fala com
ela.

### 6. O ciclo da sugestão não fecha
Existem 3 sugestões pendentes. Quem sugeriu nunca soube o que aconteceu.

## O que fazer, em ordem

### Bloco 1 — barato, retorno alto
- [ ] **Estoque → Fornecedores.** No insumo marcado como acabando, botão
      "onde comprar" que chega no Fornecedores já buscando aquele material.
- [ ] **Produzir → Fornecedores.** Onde diz "faltam 1.600 g de base", o mesmo
      botão. É o momento de compra mais concreto que existe na plataforma.
- [ ] **Trocar o vazio por sinal real.** Sai "Seja a primeira a comentar",
      entra "N alunas salvaram" e "usado no curso de Saboaria".
- [ ] **Uma tela só.** Materiais vira a tela principal; Lojas vira filtro ou
      uma linha secundária, não metade da interface.
- [ ] **Chips no lugar do menu de nicho.** São duas opções, e o resto do
      projeto (hub, Estoque, Deu problema?) já usa chips.

### Bloco 2 — depois
- [ ] **Dois campos por loja:** de qual estado envia e frete grátis a partir de
      quanto. É o que decide.
- [ ] **Ordenar por relevância:** primeiro as lojas do nicho dela e as usadas
      no curso que ela comprou. Hoje é ordem alfabética.
- [ ] **Fechar o ciclo da sugestão:** notificar quem sugeriu quando a loja entra.
- [ ] **`next/image`** no lugar das tags `<img>` cruas. A maioria acessa pelo
      celular, muitas com dado limitado.
- [ ] **Mapear os nichos que faltam** (Cosméticos, Aromas) no admin.

### Bloco 3 — a ideia que muda o jogo
- [ ] **Preço de referência por material**, mantido pela equipe. Com ele:
      - o **Estoque** passa a dizer "você pagou R$ 45 no quilo, a média é R$ 32";
      - a **Minha receita** mostra quanto do custo dela é preço ruim de compra;
      - o **Meu negócio** ganha um "onde você está perdendo dinheiro".
      Isso é o tipo de coisa que ninguém mais entrega e que justifica o
      Completo sozinha.

## Decisão de acesso (a que estava pendente no plano dos tiers)

**Recomendação: deixar Fornecedores aberto para qualquer aluna, sem filtrar por
categoria de curso.** É diretório, não é conteúdo de aula, e muita loja vende
cera e base ao mesmo tempo — filtrar esconderia loja útil. O valor está na
curadoria e na ordem em que as lojas aparecem, não em trancar.

## Dívida técnica

- `FornecedoresPage.tsx` tem 455 linhas e **três menus suspensos feitos à mão**,
  cada um com `useRef` e ouvinte de `mousedown`. Concentra quase todos os erros
  de lint do projeto.
- Imagens em `<img>` cru em vez de `next/image` (LCP e banda no celular).
- `any` em vários pontos da página e do card.
- **Filtragem inteira no cliente:** carrega 46 lojas, 17 materiais, todos os
  cursos e as 128 tags para filtrar em memória. Aguenta hoje; em ~300 lojas,
  não. Mover para o servidor quando passar de ~150.
- A página faz uma segunda consulta a `courses` só para descobrir nichos a
  partir de `product_course_links`. Dá para resolver numa view.

## Se fosse para mexer em uma coisa só

Ligar **Estoque** e **Produzir** ao Fornecedores. É a diferença entre um
diretório que ela visita de vez em quando e uma ferramenta que aparece na hora
exata em que ela precisa comprar.
