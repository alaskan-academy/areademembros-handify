/**
 * Meta de renda — quanto vender, a que preço, para ganhar o que ela quer por
 * mês. Conta simples e honesta: lucro por unidade × unidades = meta. Puro.
 */

export type EntradaMeta = {
  /** Quanto quer ganhar por mês, limpo (R$). */
  metaMes: number;
  /** Preço médio de venda (R$). */
  precoMedio: number;
  /** Custo médio por unidade (R$) — insumos, embalagem, etc. */
  custoMedio: number;
  /** Horas que ela tem por semana para produzir e vender. null = não sabe. */
  horasSemana: number | null;
  /** Minutos para fazer e embalar uma unidade. null = não sabe. */
  minutosPorUnidade: number | null;
  /** Dias por semana em que produz/vende. */
  diasPorSemana: number;
};

export type Cenario = { rotulo: string; preco: number; unidadesMes: number };

export type ResultadoMeta = {
  lucroUnidade: number;
  margemPct: number;
  unidadesMes: number;
  unidadesSemana: number;
  unidadesDia: number;
  faturamentoMes: number;
  horasNecessariasSemana: number | null;
  cabe: boolean | null;
  alertas: string[];
  cenarios: Cenario[];
};

const SEMANAS_POR_MES = 4.33;

export function calcularMeta(e: EntradaMeta): ResultadoMeta {
  const lucroUnidade = Math.round((e.precoMedio - e.custoMedio) * 100) / 100;
  const margemPct = e.precoMedio > 0 ? Math.round((lucroUnidade / e.precoMedio) * 100) : 0;
  const alertas: string[] = [];

  if (lucroUnidade <= 0) {
    alertas.push("O preço não cobre o custo: cada venda dá prejuízo. Antes de pensar em meta, acerte o preço na Minha receita.");
    return { lucroUnidade, margemPct, unidadesMes: 0, unidadesSemana: 0, unidadesDia: 0, faturamentoMes: 0, horasNecessariasSemana: null, cabe: null, alertas, cenarios: [] };
  }

  const unidadesMes = Math.ceil(e.metaMes / lucroUnidade);
  const unidadesSemana = Math.ceil(unidadesMes / SEMANAS_POR_MES);
  const dias = Math.min(7, Math.max(1, e.diasPorSemana || 5));
  const unidadesDia = Math.ceil(unidadesSemana / dias);
  const faturamentoMes = Math.round(unidadesMes * e.precoMedio * 100) / 100;

  let horasNecessariasSemana: number | null = null;
  let cabe: boolean | null = null;
  if (e.minutosPorUnidade && e.minutosPorUnidade > 0) {
    horasNecessariasSemana = Math.round(((unidadesSemana * e.minutosPorUnidade) / 60) * 10) / 10;
    if (e.horasSemana && e.horasSemana > 0) cabe = horasNecessariasSemana <= e.horasSemana;
  }

  if (margemPct < 25) alertas.push(`Margem de ${margemPct}%: apertada. Com pouco lucro por peça, a meta pede muita venda. Subir o preço ou vender kits ajuda mais que produzir mais.`);
  if (cabe === false) alertas.push(`Não cabe no seu tempo: precisa de ${(horasNecessariasSemana ?? 0).toLocaleString("pt-BR")} h por semana e você tem ${(e.horasSemana ?? 0).toLocaleString("pt-BR")}. Ou sobe o preço, ou vende em kit, ou tira tarefa da rotina (embalagem mais simples, venda em lote).`);
  if (cabe === true && horasNecessariasSemana != null && e.horasSemana && horasNecessariasSemana < e.horasSemana * 0.5) alertas.push("Sobra tempo: dá para mirar uma meta maior ou investir a folga em divulgar.");

  const cenario = (rotulo: string, preco: number): Cenario => {
    const lucro = preco - e.custoMedio;
    return { rotulo, preco: Math.round(preco * 100) / 100, unidadesMes: lucro > 0 ? Math.ceil(e.metaMes / lucro) : 0 };
  };
  const cenarios: Cenario[] = [cenario("Preço de hoje", e.precoMedio), cenario("Preço +10%", e.precoMedio * 1.1), cenario("Preço +20%", e.precoMedio * 1.2)];

  return { lucroUnidade, margemPct, unidadesMes, unidadesSemana, unidadesDia, faturamentoMes, horasNecessariasSemana, cabe, alertas, cenarios };
}
