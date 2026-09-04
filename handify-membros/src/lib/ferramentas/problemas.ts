/**
 * Deu problema? — o que deu errado na peça, a causa e como corrigir. Conteúdo
 * puro, revisável pela professora; a tela só filtra e mostra.
 */

export type ProdutoProblema = "velas" | "glicerinado" | "cold_process" | "cosmetico";

export const PRODUTOS_PROBLEMA: { key: ProdutoProblema; nome: string; emoji: string }[] = [
  { key: "velas", nome: "Velas", emoji: "🕯️" },
  { key: "glicerinado", nome: "Sabonete glicerinado", emoji: "🧼" },
  { key: "cold_process", nome: "Sabonete cold process", emoji: "🧪" },
  { key: "cosmetico", nome: "Cosméticos", emoji: "🫙" },
];

export type Problema = {
  id: string;
  produto: ProdutoProblema;
  titulo: string;
  /** Como ela descreveria — para a busca achar ("afundou", "buraco"). */
  sinais: string;
  causas: string[];
  corrigir: string[];
  evitar: string[];
  /** Ferramenta que ajuda a resolver de vez. */
  link?: { texto: string; href: string };
};

export const PROBLEMAS: Problema[] = [
  // ── Velas ──
  {
    id: "vela-tunel",
    produto: "velas",
    titulo: "Fez túnel (queimou só o meio)",
    sinais: "buraco no centro, cera sobrando na borda, túnel",
    causas: ["Pavio fino demais para o diâmetro do pote", "Primeira queima curta: apagou antes de a piscina de cera chegar à borda", "Cera muito dura para o pavio escolhido"],
    corrigir: ["Na próxima acesa, deixe queimar até a cera derreter até a borda (1 hora por 2,5 cm de diâmetro)", "Se o túnel já está fundo, retire a cera da borda com uma colher aquecida e nivele", "Método do papel-alumínio: cubra a borda deixando o centro aberto por 1 a 2 horas"],
    evitar: ["Escolha o pavio pelo diâmetro do pote, não pela altura", "Faça teste de queima antes de produzir em lote", "Ponha no rótulo: primeira queima até a borda"],
    link: { texto: "Qual pavio usar", href: "/ferramentas/calculadora-pavio" },
  },
  {
    id: "vela-afundou",
    produto: "velas",
    titulo: "Afundou no meio depois de esfriar",
    sinais: "buraco perto do pavio, cratera, cera encolheu, afundou",
    causas: ["Cera despejada quente demais para o tipo", "Esfriou rápido demais (ambiente frio, corrente de ar)", "Cera encolhe ao esfriar: normal em parafina, pouco em soja"],
    corrigir: ["Guarde um pouco de cera e faça um segundo despejo, na mesma temperatura, para cobrir o buraco", "Aqueça a superfície com secador ou pistola de calor até nivelar"],
    evitar: ["Despeje na temperatura da cera (soja ≈ 55 a 65 °C; parafina ≈ 70 a 75 °C)", "Deixe esfriar devagar, longe de vento e sem geladeira", "Pré-aqueça os potes de vidro"],
  },
  {
    id: "vela-rachou",
    produto: "velas",
    titulo: "Rachou ou trincou o topo",
    sinais: "rachadura, trinca, quebrou, fissura no topo",
    causas: ["Esfriou rápido demais", "Cera despejada muito quente em pote frio", "Água ou umidade na cera"],
    corrigir: ["Reaqueça a superfície com pistola de calor e deixe esfriar devagar", "Se rachou fundo, derreta de novo e refaça"],
    evitar: ["Ambiente sem corrente de ar e sem geladeira", "Pote em temperatura ambiente ou levemente aquecido", "Nunca deixe água cair na cera"],
  },
  {
    id: "vela-frosting",
    produto: "velas",
    titulo: "Manchas brancas na cera de soja (frosting)",
    sinais: "manchas brancas, esbranquiçado, aspecto de gelo, cristalizou",
    causas: ["Cristalização natural da soja ao esfriar", "Mudança de temperatura depois de pronta", "Corante em excesso realça as manchas"],
    corrigir: ["Não compromete a queima — é só estética. Aquecer levemente a lateral do vidro com secador disfarça", "Velas brancas ou sem corante escondem melhor"],
    evitar: ["Despeje mais frio (perto de 55 °C) e esfrie devagar", "Aditivo antifrosting ou blend com coco reduz", "Guarde longe de variação de temperatura"],
  },
  {
    id: "vela-suando",
    produto: "velas",
    titulo: "Suando ou oleosa por cima",
    sinais: "gotinhas de óleo, superfície molhada, suou, oleosa",
    causas: ["Essência acima do que a cera segura (mais de 10%)", "Essência adicionada com a cera fria demais, não incorporou", "Calor no ambiente de armazenamento"],
    corrigir: ["Seque com papel toalha antes de vender", "Cera com essência no limite: leve as próximas para 6 a 8%"],
    evitar: ["Adicione a essência na temperatura certa (cerca de 65 a 70 °C) e mexa 2 minutos", "Respeite o limite de fragrância da cera", "Guarde em lugar fresco"],
    link: { texto: "Calculadora de essências", href: "/ferramentas/calculadora-essencias/velas" },
  },
  {
    id: "vela-chama-alta",
    produto: "velas",
    titulo: "Chama alta, fumaça preta, cogumelo no pavio",
    sinais: "fumaça, fuligem, chama grande, ponta preta no pavio, cogumelo, mushrooming",
    causas: ["Pavio grosso demais para o pote", "Pavio comprido (não aparado)", "Excesso de essência ou de corante"],
    corrigir: ["Apague, apare o pavio a 5 mm e acenda de novo", "Nas próximas, desça um número de pavio"],
    evitar: ["Teste de queima antes do lote", "Apare o pavio a cada uso — ponha isso no rótulo"],
    link: { texto: "Qual pavio usar", href: "/ferramentas/calculadora-pavio" },
  },
  {
    id: "vela-afoga",
    produto: "velas",
    titulo: "Chama pequena, apaga sozinha, afoga",
    sinais: "chama fraca, apaga, afogou, pavio afundou na cera",
    causas: ["Pavio fino demais", "Piscina de cera funda cobrindo o pavio", "Cera muito dura ou muita essência"],
    corrigir: ["Retire um pouco da cera derretida com papel toalha", "Nas próximas, suba um número de pavio"],
    evitar: ["Pavio pelo diâmetro do pote e pelo tipo de cera", "Mantenha o pavio em 5 mm, não menos"],
    link: { texto: "Qual pavio usar", href: "/ferramentas/calculadora-pavio" },
  },
  {
    id: "vela-cheiro-fraco",
    produto: "velas",
    titulo: "Cheiro fraco (não perfuma o ambiente)",
    sinais: "não cheira, aroma fraco, perfume sumiu, sem cheiro quando acesa",
    causas: ["Pouca essência (abaixo de 6%)", "Essência adicionada quente demais (evaporou) ou fria demais (não incorporou)", "Vela nova: a soja precisa descansar de 4 a 10 dias para o aroma firmar", "Pavio pequeno: piscina de cera pequena espalha pouco aroma"],
    corrigir: ["Espere o descanso antes de julgar", "Se já descansou, na próxima suba a essência para 8 a 10% e confira a temperatura"],
    evitar: ["Calcule a essência pelo peso da cera", "Adicione entre 65 e 70 °C com o fogo desligado", "Deixe descansar antes de vender"],
    link: { texto: "Calculadora de essências", href: "/ferramentas/calculadora-essencias/velas" },
  },
  {
    id: "vela-descolou",
    produto: "velas",
    titulo: "Descolou do vidro (manchas de ar na lateral)",
    sinais: "manchas na lateral, descolou do pote, bolhas de ar no vidro, wet spots",
    causas: ["Vidro frio na hora do despejo", "Esfriou rápido", "Vidro com resíduo ou umidade"],
    corrigir: ["Aqueça a lateral do vidro com secador para a cera voltar a grudar (estética)", "Não afeta a queima"],
    evitar: ["Pré-aqueça os vidros (forno baixo ou secador)", "Lave e seque bem os potes", "Esfrie devagar"],
  },
  // ── Glicerinado ──
  {
    id: "glic-suando",
    produto: "glicerinado",
    titulo: "Suando (gotinhas na superfície)",
    sinais: "suou, gotas, molhado, pegajoso, orvalho",
    causas: ["Glicerina puxa umidade do ar — normal em dia úmido", "Sabonete sem embalagem", "Excesso de líquidos na receita (álcool, extrato, essência)"],
    corrigir: ["Seque com papel toalha e embale na hora", "Deixe em lugar seco com ventilador antes de embalar"],
    evitar: ["Embale em filme plástico ou saquinho fechado assim que desenformar", "Base de boa qualidade (menos glicerina livre)", "Guarde longe de umidade"],
  },
  {
    id: "glic-bolhas",
    produto: "glicerinado",
    titulo: "Cheio de bolhas",
    sinais: "bolhas, furinhos, ar dentro, espuma por cima",
    causas: ["Mexeu demais ou rápido demais", "Derreteu quente demais (ferveu)", "Despejou de alto"],
    corrigir: ["Borrife álcool 70% na superfície logo depois de despejar — estoura as bolhas", "Se ficou por dentro, derreta de novo devagar"],
    evitar: ["Derreta em banho-maria ou micro-ondas em pulsos curtos, sem ferver", "Mexa devagar", "Despeje encostando na forma"],
  },
  {
    id: "glic-mole",
    produto: "glicerinado",
    titulo: "Muito mole ou derretendo",
    sinais: "mole, derrete, não endurece, amolecido, deformou",
    causas: ["Excesso de óleos, manteigas ou líquidos na base", "Base de má qualidade", "Calor no armazenamento"],
    corrigir: ["Derreta e misture com base nova sem aditivo", "Guarde em lugar fresco"],
    evitar: ["Aditivos até 1 a 2% do peso da base", "Fornecedor de confiança", "Nunca deixe no sol ou no carro"],
    link: { texto: "Fornecedores", href: "/ferramentas/fornecedores" },
  },
  {
    id: "glic-camadas",
    produto: "glicerinado",
    titulo: "Camadas separando",
    sinais: "descolou a camada, separou, camadas soltas, duas cores desgrudaram",
    causas: ["Camada de baixo fria demais quando despejou a de cima", "Sem álcool entre as camadas"],
    corrigir: ["Derreta de novo e refaça em camadas na temperatura certa"],
    evitar: ["Borrife álcool 70% na camada de baixo antes de despejar a próxima", "Despeje quando a camada de baixo formou pele mas ainda está morna"],
  },
  {
    id: "glic-opaco",
    produto: "glicerinado",
    titulo: "Base transparente ficou opaca ou embaçada",
    sinais: "embaçou, opaco, perdeu a transparência, turvo, esbranquiçado",
    causas: ["Superaqueceu ou reaqueceu muitas vezes", "Aditivos que não são solúveis (óleo em excesso, mica sem dispersar)", "Umidade"],
    corrigir: ["Não volta: use a base opaca em receitas com cor sólida"],
    evitar: ["Derreta só o que vai usar, sem ferver", "Disperse a mica em um pouco de álcool ou glicerina antes"],
  },
  {
    id: "glic-cheiro-fraco",
    produto: "glicerinado",
    titulo: "Cheiro fraco ou que sumiu",
    sinais: "não cheira, aroma sumiu, perdeu o perfume",
    causas: ["Essência abaixo de 1%", "Adicionou com a base quente demais (evaporou)", "Sabonete sem embalagem perde aroma"],
    corrigir: ["Embale bem os que já fez", "Nas próximas: 1 a 3% de essência, base a 55 a 60 °C"],
    evitar: ["Calcule a essência pelo peso do lote", "Embale assim que desenformar"],
    link: { texto: "Calculadora de essências", href: "/ferramentas/calculadora-essencias/sabonetes" },
  },
  // ── Cold process ──
  {
    id: "cp-pontos-laranja",
    produto: "cold_process",
    titulo: "Pontos laranja (DOS)",
    sinais: "pontos laranja, manchas alaranjadas, cheiro de ranço, óleo velho",
    causas: ["Óleo rancificou: óleos frágeis (girassol, uva) ou já velhos", "Água com metais, sem sequestrante", "Calor e luz no armazenamento"],
    corrigir: ["Não vende: o cheiro piora. Use em casa ou descarte", "Confira a validade dos óleos que sobraram"],
    evitar: ["Antioxidante (vitamina E, extrato de alecrim ou BHT) e EDTA na água da soda", "Óleos novos, dentro da validade", "Guarde seco, fresco e escuro"],
    link: { texto: "Validade do produto", href: "/ferramentas/validade" },
  },
  {
    id: "cp-soda-ash",
    produto: "cold_process",
    titulo: "Pó branco na superfície (soda ash)",
    sinais: "pó branco, camada esbranquiçada, cinza de soda, manchado de branco",
    causas: ["Soda reagiu com o ar antes de saponificar", "Despejou em traço muito leve", "Não cobriu o molde"],
    corrigir: ["É só estético: lave a superfície com água morna ou passe vapor", "Aplaine com um raspador"],
    evitar: ["Cubra o molde com plástico filme encostado", "Borrife álcool 70% na superfície logo após despejar", "Despeje em traço um pouco mais firme"],
  },
  {
    id: "cp-rachou",
    produto: "cold_process",
    titulo: "Rachou no topo ou fez vulcão",
    sinais: "rachadura, rachou, vulcão, estufou, transbordou, gel no centro",
    causas: ["Superaqueceu na fase de gel (isolou demais ou receita com mel, leite, açúcar)", "Água de menos (concentração de soda alta)", "Essência que acelera"],
    corrigir: ["Se só rachou, ainda é sabonete: corte e cure normalmente", "Se vazou ou ficou oleoso, refaça (rebatch)"],
    evitar: ["Não isole receitas com açúcares; ponha na geladeira nas primeiras horas se precisar", "Use a água na proporção da receita", "Teste a essência numa quantidade pequena antes"],
  },
  {
    id: "cp-acelerou",
    produto: "cold_process",
    titulo: "Endureceu na panela (acelerou o traço)",
    sinais: "endureceu rápido, virou pedra, não deu tempo, empelotou, acelerou",
    causas: ["Essência ou óleo essencial que acelera (florais, canela, cravo)", "Temperatura alta da soda ou dos óleos", "Muita manteiga dura ou cera na receita"],
    corrigir: ["Coloque no molde como der, aperte bem — vira sabonete rústico", "Se empelotou muito, faça rebatch"],
    evitar: ["Trabalhe frio (30 a 38 °C) e sem mixer demais", "Pesquise a essência antes ('acelera o traço?')", "Adicione a essência por último e mexa à mão"],
  },
  {
    id: "cp-separou",
    produto: "cold_process",
    titulo: "Óleo separou ou ficou oleoso",
    sinais: "óleo por cima, separou, oleoso, molhado, poças de óleo",
    causas: ["Traço falso: misturou pouco", "Superaqueceu e separou", "Erro de pesagem da soda"],
    corrigir: ["Se foi pouco, refaça a mistura (rebatch) com calor brando", "Se a soda foi errada, descarte com segurança"],
    evitar: ["Bata até o traço de verdade (rastro que fica)", "Pese soda e óleos na balança, nunca por medida", "Confira a receita numa calculadora de saponificação"],
  },
  {
    id: "cp-zap",
    produto: "cold_process",
    titulo: "Arde ou dá choque na língua (soda livre)",
    sinais: "arde, choque na língua, teste do zap, cáustico, queima a pele",
    causas: ["Soda a mais na receita", "Mal misturado: bolsões de soda", "Cura curta demais"],
    corrigir: ["Espere a cura completa e teste de novo", "Se ainda arde depois de 6 semanas, não use na pele: refaça com mais óleo (rebatch) ou use para limpeza"],
    evitar: ["Superfat de 5 a 8%", "Misture até o traço em toda a massa", "Cura de 4 a 6 semanas"],
  },
  {
    id: "cp-mole-quebradico",
    produto: "cold_process",
    titulo: "Muito mole ou muito quebradiço",
    sinais: "mole, não endurece, quebradiço, esfarela, quebra ao cortar",
    causas: ["Mole: muitos óleos líquidos, água demais, pouca cura", "Quebradiço: muitos óleos duros ou soda a mais, cortou tarde"],
    corrigir: ["Mole: mais cura, em lugar arejado", "Quebradiço: corte mais cedo nas próximas; confira a soda"],
    evitar: ["Equilibre óleos duros e líquidos (por volta de 40 a 60% duros)", "Corte entre 24 e 48 horas"],
  },
  // ── Cosméticos ──
  {
    id: "cos-granulou",
    produto: "cosmetico",
    titulo: "Manteiga corporal granulou (bolinhas)",
    sinais: "granulou, bolinhas, arenoso, textura de areia",
    causas: ["Manteiga (karité, cacau) esfriou devagar e cristalizou", "Reaquecimento parcial"],
    corrigir: ["Derreta tudo de novo e esfrie rápido (geladeira ou banho de gelo) mexendo"],
    evitar: ["Resfrie rápido depois de derreter", "Bata na batedeira só depois de firmar"],
  },
  {
    id: "cos-separou",
    produto: "cosmetico",
    titulo: "Hidratante ou creme separou (emulsão quebrou)",
    sinais: "separou, água por cima, talhou, desandou, oleoso",
    causas: ["Fases (água e óleo) em temperaturas diferentes", "Emulsionante de menos ou errado", "Bateu pouco ou mexeu tarde"],
    corrigir: ["Aqueça de novo as duas fases a 70 a 75 °C e bata com mixer; se não voltar, descarte"],
    evitar: ["Fases na mesma temperatura", "Emulsionante na dose do fabricante", "Bata até esfriar um pouco"],
  },
  {
    id: "cos-mofo",
    produto: "cosmetico",
    titulo: "Mofo, cheiro azedo ou mudou de cor",
    sinais: "mofo, bolor, azedou, cheiro estranho, mudou a cor, pontinhos pretos",
    causas: ["Produto com água sem conservante", "Conservante fora do pH", "Contaminação (mão, pote sujo)"],
    corrigir: ["Descarte. Não dá para salvar produto contaminado"],
    evitar: ["Conservante de amplo espectro sempre que tiver água", "Potes e utensílios limpos com álcool 70%", "Confira o pH"],
    link: { texto: "Validade do produto", href: "/ferramentas/validade" },
  },
  {
    id: "cos-ranco",
    produto: "cosmetico",
    titulo: "Cheiro de óleo velho (ranço)",
    sinais: "ranço, cheiro de óleo velho, cheiro de fritura, amargo",
    causas: ["Óleo oxidou: frágil (girassol, uva) ou vencido", "Calor e luz"],
    corrigir: ["Descarte: rancificado irrita a pele"],
    evitar: ["Antioxidante (vitamina E, extrato de alecrim)", "Óleos novos e guardados no escuro", "Validade curta no rótulo"],
    link: { texto: "Validade do produto", href: "/ferramentas/validade" },
  },
];

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function buscarProblemas(produto: ProdutoProblema | null, termo: string): Problema[] {
  const t = normalizar(termo.trim());
  return PROBLEMAS.filter((p) => (!produto || p.produto === produto) && (!t || normalizar(`${p.titulo} ${p.sinais}`).includes(t)));
}
