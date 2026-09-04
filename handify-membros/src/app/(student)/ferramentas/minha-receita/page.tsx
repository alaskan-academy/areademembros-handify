import { assertToolAccess, getToolsForViewer } from '@/lib/ferramentas/access'
import { produtoPadrao } from '@/lib/ferramentas/produtos'
import { getWickRecommendations } from '@/lib/pavio/actions'
import { carregarReceita } from '@/lib/receitas/actions'
import MinhaReceita, { type AcessoEtapas, type Receita } from '@/components/ferramentas/MinhaReceita'

export const metadata = {
  title: 'Minha receita | Handify',
  description: 'Do ingrediente ao preço, num fluxo só — quanto de essência, qual pavio, quanto custa e por quanto vender.',
}

export default async function MinhaReceitaPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; produto?: string; receita?: string; nova?: string }>
}) {
  await assertToolAccess('minha-receita')
  const { etapa, produto, receita, nova } = await searchParams

  // As etapas de aluna (Essências, Pavio) obedecem à mesma regra das
  // ferramentas avulsas: o estado vem da tabela `tools`, por categoria de curso.
  // `?receita=` abre uma guardada na conta (só a dona consegue carregar).
  const [dados, recomendacoes, guardada] = await Promise.all([
    getToolsForViewer(),
    getWickRecommendations(),
    receita ? carregarReceita(receita) : Promise.resolve(null),
  ])
  const estadoDe = (slug: string) => {
    const t = dados.tools.find(x => x.slug === slug)
    return { state: t?.state ?? 'com_curso', libera: t?.unlockCategories ?? [] }
  }
  const acesso: AcessoEtapas = {
    essencias: estadoDe('calculadora-essencias'),
    pavio: estadoDe('calculadora-pavio'),
  }

  return (
    <MinhaReceita
      acesso={acesso}
      recomendacoes={recomendacoes}
      planLink={dados.planLink}
      tier={dados.tier}
      etapaInicial={guardada ? etapa ?? 'ficha' : etapa}
      produtoInicial={produto}
      produtoPadrao={produtoPadrao(dados.categorias, dados.tier === 'completo' || dados.tier === 'admin')}
      receitaInicial={guardada ? { id: guardada.id, data: guardada.data as Receita } : null}
      nova={nova === '1'}
    />
  )
}
