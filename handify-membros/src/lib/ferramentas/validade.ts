/**
 * Validade do produto — quanto tempo dura o que ela fez, e o que limita.
 *
 * Regra central: "o ingrediente que vence primeiro manda". Em cima dela, o que
 * muda a conta: água sem conservante (7 dias), ingrediente fresco, óleos que
 * rancificam rápido, antioxidante, embalagem, tipo de aroma. Tudo puro, sem
 * banco, para testar com número na mão. Tabela de referência a ser validada
 * pela professora de saboaria — é estimativa para planejar e etiquetar.
 */

export type TipoProduto = "glicerinado" | "cold_process" | "liquido" | "anidro" | "com_agua" | "vela";

export const TIPOS: { key: TipoProduto; nome: string; exemplo: string; temAgua: boolean; emoji: string }[] = [
  { key: "glicerinado", nome: "Sabonete glicerinado", exemplo: "base pronta (melt & pour)", temAgua: false, emoji: "🧼" },
  { key: "cold_process", nome: "Sabonete cold process", exemplo: "soda + óleos, com cura", temAgua: false, emoji: "🧪" },
  { key: "liquido", nome: "Sabonete líquido", exemplo: "xampu, gel, sabonete de mãos", temAgua: true, emoji: "🫧" },
  { key: "anidro", nome: "Cosmético sem água", exemplo: "manteiga corporal, óleo, bálsamo, sal de banho", temAgua: false, emoji: "🫙" },
  { key: "com_agua", nome: "Cosmético com água", exemplo: "hidratante, tônico, bruma, escalda-pés líquido", temAgua: true, emoji: "💧" },
  { key: "vela", nome: "Vela", exemplo: "qualquer cera", temAgua: false, emoji: "🕯️" },
];

export type Conservante = "nenhum" | "sintetico" | "natural" | "nao_sei";
export type Aroma = "nenhum" | "essencia" | "oleo_essencial";
export type Embalagem = "fechada" | "aberta";

export type Insumo = { nome: string; validade: string | null };

export type EntradaValidade = {
  tipo: TipoProduto;
  /** Data em que fez (cold process: fim da cura). YYYY-MM-DD. */
  fabricacao: string;
  conservante: Conservante;
  /** Prazo que o fabricante do conservante indica, em meses. null = padrão (3). */
  prazoConservanteMeses: number | null;
  antioxidante: boolean;
  /** Girassol, uva, cânhamo, linhaça, rosa mosqueta… */
  oleosFrageis: boolean;
  /** Fruta, leite, ervas in natura. */
  frescos: boolean;
  aroma: Aroma;
  embalagem: Embalagem;
  insumos: Insumo[];
};

export type Alerta = { nivel: "perigo" | "atencao" | "dica"; texto: string };
export type Sugestao = { titulo: string; opcoes: string[]; nota?: string };

export type ResultadoValidade = {
  dias: number;
  prazoTexto: string;
  vence: string;
  limitante: string;
  alertas: Alerta[];
  sugestoes: Sugestao[];
  rotulo: { fabricacao: string; validade: string; lote: string };
};

const DIA = 86400000;

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function somarDias(data: string, dias: number): string {
  const [y, m, d] = partes(data);
  const t = new Date(Date.UTC(y, m - 1, d) + dias * DIA);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 31/08 + 6 meses = 28/02 (não pula para março). */
export function somarMeses(data: string, meses: number): string {
  const [y, m, d] = partes(data);
  const total = m - 1 + meses;
  const ano = y + Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return iso(ano, mes, Math.min(d, ultimoDia));
}

export function diffDias(de: string, ate: string): number {
  const [y1, m1, d1] = partes(de);
  const [y2, m2, d2] = partes(ate);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA);
}

export function dataBR(isoData: string): string {
  const [y, m, d] = partes(isoData);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function prazoTexto(dias: number): string {
  if (dias <= 0) return "vencido";
  if (dias < 30) return `${dias} dia${dias !== 1 ? "s" : ""}`;
  const meses = Math.round(dias / 30.44);
  if (meses < 1) return `${dias} dias`;
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function temAgua(tipo: TipoProduto): boolean {
  return TIPOS.find((t) => t.key === tipo)?.temAgua ?? false;
}

export function calcularValidade(e: EntradaValidade): ResultadoValidade {
  const alertas: Alerta[] = [];
  const sugestoes: Sugestao[] = [];
  const agua = temAgua(e.tipo);
  const conservado = e.conservante === "sintetico" || e.conservante === "natural";

  let meses = 0;
  let dias: number | null = null;
  let limitante = "";

  switch (e.tipo) {
    case "glicerinado": {
      meses = e.embalagem === "fechada" ? 12 : 6;
      limitante = e.embalagem === "fechada" ? "a base glicerinada" : "a base glicerinada sem embalar (sua e perde aroma)";
      if (e.aroma === "oleo_essencial") {
        meses = Math.round(meses * 0.75);
        limitante = "o óleo essencial, que perde força antes da base";
      }
      break;
    }
    case "cold_process":
    case "anidro": {
      meses = e.oleosFrageis ? 6 : 12;
      if (e.antioxidante) meses = Math.round(meses * 1.5);
      limitante = e.oleosFrageis
        ? "os óleos que rancificam rápido (girassol, uva, cânhamo, linhaça)"
        : e.tipo === "cold_process"
          ? "os óleos da receita (rancificação), contando do fim da cura"
          : "o óleo ou manteiga que rancifica primeiro";
      if (e.antioxidante) limitante += " — o antioxidante alongou";
      break;
    }
    case "liquido":
    case "com_agua": {
      if (!conservado) {
        dias = 7;
        limitante = "água sem conservante: micróbio cresce em dias";
      } else {
        meses = e.prazoConservanteMeses ?? 3;
        if (meses > 6) {
          meses = 6;
          alertas.push({ nivel: "atencao", texto: "Sem teste de estabilidade, o máximo prudente para produto com água é 6 meses, mesmo que o conservante prometa mais." });
        }
        limitante = "o prazo do conservante (faixa do fabricante)";
      }
      break;
    }
    case "vela": {
      meses = e.aroma === "nenhum" ? 24 : 12;
      limitante = e.aroma === "nenhum" ? 'a cera não vence — 24 meses é um "melhor até"' : "o aroma, que enfraquece com o tempo (a cera não vence)";
      break;
    }
  }

  // Ingrediente fresco puxa tudo para baixo, com ou sem água na fórmula.
  if (e.frescos) {
    if (!conservado) {
      dias = 7;
      meses = 0;
      limitante = "ingrediente fresco (fruta, leite, erva) sem conservante";
    } else if (dias == null && meses > 1) {
      meses = 1;
      limitante = "ingrediente fresco — mesmo com conservante, não passe de 1 mês";
    }
  }

  let vence = dias != null ? somarDias(e.fabricacao, dias) : somarMeses(e.fabricacao, meses);

  // Regra central: nunca passa da validade restante do insumo.
  for (const i of e.insumos) {
    if (!i.validade || !i.nome.trim()) continue;
    if (i.validade < e.fabricacao) {
      alertas.push({ nivel: "perigo", texto: `${i.nome.trim()} já venceu em ${dataBR(i.validade)} — não use nesse lote.` });
      continue;
    }
    if (i.validade < vence) {
      vence = i.validade;
      limitante = `${i.nome.trim()}, que vence em ${dataBR(i.validade)}`;
      alertas.push({ nivel: "atencao", texto: `${i.nome.trim()} vence antes do que o produto duraria. Com um lote novo desse insumo você ganha prazo.` });
    }
  }

  const totalDias = Math.max(0, diffDias(e.fabricacao, vence));

  // Alertas de segurança e de oxidação
  if (agua && !conservado) {
    alertas.unshift({
      nivel: "perigo",
      texto:
        e.conservante === "nao_sei"
          ? "Não sabe se tem conservante? Trate como sem: 7 dias na geladeira. Produto com água sem conservante cria bactéria e fungo sem você ver."
          : "Produto com água e sem conservante: 7 dias na geladeira, e só. Bactéria e fungo crescem sem você ver. Para durar meses, precisa de conservante de amplo espectro.",
    });
  }
  if (e.frescos && !agua && !conservado) {
    alertas.unshift({ nivel: "perigo", texto: "Fruta, leite ou erva fresca trazem água e alimento para micróbio. Sem conservante, 7 dias na geladeira." });
  }
  if (e.oleosFrageis) {
    alertas.push({
      nivel: "atencao",
      texto:
        "Oxidação: girassol, uva, cânhamo e linhaça rancificam em poucos meses. Sinais: cheiro de óleo velho, pontos laranja no cold process, escurecimento. Antioxidante ajuda; longe de luz e calor também.",
    });
  }
  if (e.antioxidante && agua && !conservado) {
    alertas.push({ nivel: "atencao", texto: "Vitamina E, extrato de alecrim e BHT seguram a oxidação do óleo — não seguram micróbio. Antioxidante não substitui conservante." });
  }
  if (e.tipo === "glicerinado" && e.embalagem === "aberta") {
    alertas.push({ nivel: "dica", texto: 'Glicerinado sem embalar "sua" (a glicerina puxa umidade do ar) e perde aroma. Filme plástico ou saquinho fechado dobra o prazo.' });
  }
  if (e.tipo === "cold_process") {
    alertas.push({ nivel: "dica", texto: "No cold process a validade conta do fim da cura (4 a 6 semanas). Barra bem seca e arejada dura mais." });
  }
  if (e.aroma === "oleo_essencial" && e.tipo !== "vela") {
    alertas.push({ nivel: "dica", texto: "Óleo essencial perde força antes que essência. Conte com isso no aroma, não na segurança." });
  }
  alertas.push({ nivel: "dica", texto: "Guarde em lugar seco, fresco e sem sol. Calor e luz encurtam tudo." });
  alertas.push({ nivel: "dica", texto: "Estimativa para planejar e etiquetar. Para vender em escala ou registrar na ANVISA, o teste de estabilidade é que define." });

  // Sugestões de aditivo — pelo problema, sempre natural e sintético, com faixa de dose
  if (agua || (e.frescos && !conservado)) {
    sugestoes.push({
      titulo: agua ? "Conservante (obrigatório com água)" : "Conservante (ingrediente fresco pede)",
      opcoes: [
        "Sintético: fenoxietanol + etilhexilglicerina (Euxyl PE 9010 e similares), 0,5 a 1% — funciona de pH 3 a 12, o mais usado",
        "Aceito em cosmética natural: ácido desidroacético + álcool benzílico (Geogard 221, Sharomix, Cosgard), 0,5 a 1% — só em pH até 6",
        "Natural: sorbato de potássio + benzoato de sódio, 0,1 a 0,5% cada — só em pH abaixo de 5,5, fraco sozinho",
      ],
      nota: "Dose sobre o peso total da receita. Siga a faixa do fabricante do seu insumo e confira o pH. Evite metilisotiazolinona (Kathon) em produto que fica na pele.",
    });
  }
  if (e.tipo === "cold_process" || e.tipo === "anidro" || e.oleosFrageis) {
    sugestoes.push({
      titulo: e.antioxidante ? "Antioxidante (você já usa — confira a dose)" : "Antioxidante (contra rancificação)",
      opcoes: ["Natural: vitamina E (tocoferol), 0,1 a 0,5%", "Natural: extrato de alecrim (ROE), 0,05 a 0,1%", "Sintético: BHT, 0,01 a 0,1% — barato e fácil de achar"],
      nota:
        e.tipo === "cold_process"
          ? "No cold process, EDTA dissódico 0,1 a 0,2% dissolvido na água da soda ajuda contra pontos laranja. Antioxidante alonga o óleo; não conserva contra micróbio."
          : "Antioxidante alonga o óleo; não conserva contra micróbio.",
    });
  }
  if (e.frescos) {
    sugestoes.push({
      titulo: "Ingrediente fresco",
      opcoes: [
        "Troque pela versão em pó (leite em pó, fruta desidratada) ou extrato glicólico — dura o que o produto dura",
        "Se for usar fresco mesmo: faça pouco, avise a cliente e mantenha 7 dias na geladeira",
      ],
    });
  }

  const [, mm] = partes(e.fabricacao);
  const yy = e.fabricacao.slice(2, 4);
  return {
    dias: totalDias,
    prazoTexto: prazoTexto(totalDias),
    vence,
    limitante,
    alertas,
    sugestoes,
    rotulo: { fabricacao: dataBR(e.fabricacao), validade: dataBR(vence), lote: `${String(mm).padStart(2, "0")}${yy}-01` },
  };
}
