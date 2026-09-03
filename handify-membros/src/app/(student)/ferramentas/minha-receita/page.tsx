import { assertToolAccess, getToolsForViewer } from '@/lib/ferramentas/access'
import { getWickRecommendations } from '@/lib/pavio/actions'
import MinhaReceita, { type AcessoEtapas } from '@/components/ferramentas/MinhaReceita'

export const metadata = {
  title: 'Minha receita | Handify',
  description: 'Do ingrediente ao preço, num fluxo só — quanto de essência, qual pavio, quanto custa e por quanto vender.',
}

export default async function MinhaReceitaPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; produto?: string }>
}) {
  await assertToolAccess('minha-receita')
  const { etapa, produto } = await searchParams

  // As etapas de aluna (Essências, Pavio) obedecem à mesma regra das
  // ferramentas avulsas: o estado vem da tabela `tools`, por categoria de curso.
  const [dados, recomendacoes] = await Promise.all([getToolsForViewer(), getWickRecommendations()])
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
      etapaInicial={etapa}
      produtoInicial={produto}
    />
  )
}
