import { assertToolAccess } from '@/lib/ferramentas/access'
import { listarInsumosComValidade } from '@/lib/estoque/actions'
import { TIPOS, type TipoProduto } from '@/lib/ferramentas/validade'
import Validade from '@/components/ferramentas/Validade'

export const metadata = {
  title: 'Validade do produto | Handify',
  description: 'Quanto tempo dura o que você fez, o que limita, e o texto pronto para o rótulo.',
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function ValidadePage({ searchParams }: { searchParams: Promise<{ voltar?: string; tipo?: string; insumos?: string }> }) {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  const [dados, { voltar, tipo, insumos }, insumosEstoque] = await Promise.all([assertToolAccess('validade-produto'), searchParams, listarInsumosComValidade()])

  // Vindo da receita (`?voltar=receita`): tipo e insumos com data já preenchidos.
  const tipoInicial = TIPOS.some(t => t.key === tipo) ? (tipo as TipoProduto) : undefined
  const insumosIniciais = (insumos ?? '')
    .split(';')
    .map(par => par.split('|'))
    .filter(([nome, data]) => nome && data && ISO.test(data))
    .slice(0, 20)
    .map(([nome, data]) => ({ nome: nome.slice(0, 60), validade: data }))

  // Os tipos de produto seguem o curso dela; Completo e admin veem todos.
  // `?voltar=rotulo`: veio do Rótulo e volta com a validade preenchida.
  // Quem tem estoque com data puxa o insumo de lá — "o que vence primeiro manda".
  return (
    <Validade
      categorias={dados.categorias}
      tudoLiberado={dados.tier === 'completo' || dados.tier === 'admin'}
      voltar={voltar}
      insumosEstoque={insumosEstoque}
      tipoInicial={tipoInicial}
      insumosIniciais={insumosIniciais}
    />
  )
}
