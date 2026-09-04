import { assertToolAccess } from '@/lib/ferramentas/access'
import { produtosLiberados } from '@/lib/ferramentas/produtos'
import DeuProblema from '@/components/ferramentas/DeuProblema'
import type { ProdutoProblema } from '@/lib/ferramentas/problemas'

export const metadata = {
  title: 'Deu problema? | Handify',
  description: 'Afundou, rachou, fez túnel — a causa e como corrigir.',
}

export default async function DeuProblemaPage() {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  const dados = await assertToolAccess('deu-problema')

  // Gratuita e aberta a tudo; só começa filtrada pelo que o curso dela ensina.
  const lib = produtosLiberados(dados.categorias, false)
  const produtoInicial: ProdutoProblema | null = lib.length === 1 ? (lib[0] === 'velas' ? 'velas' : 'glicerinado') : null

  return <DeuProblema produtoInicial={produtoInicial} />
}
