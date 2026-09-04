import { redirect } from 'next/navigation'
import { getToolsForViewer } from '@/lib/ferramentas/access'
import { listarCatalogo } from '@/lib/catalogo/actions'
import Catalogo from '@/components/ferramentas/Catalogo'

export const metadata = { title: 'Catálogo e preços | Handify' }

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ receita?: string }> }) {
  const [dados, catalogo, { receita }] = await Promise.all([getToolsForViewer(), listarCatalogo(), searchParams])
  const tool = dados.tools.find(t => t.slug === 'catalogo-precos')

  // "Nunca some, só congela": quem já montou o catálogo entra mesmo sem o plano
  // ativo (lê e gera o PDF). Quem nunca montou e não tem o plano vê o caminho
  // na lista de ferramentas.
  if ((!tool || tool.state !== 'aberta') && catalogo.produtos.length === 0 && !catalogo.marca.brand_name) {
    redirect('/ferramentas?bloqueada=catalogo-precos')
  }

  // `?receita=`: veio da ficha da receita — abre "novo produto" já com ela escolhida.
  return <Catalogo {...catalogo} planLink={dados.planLink} receitaInicial={receita && catalogo.receitas.some(r => r.id === receita) ? receita : undefined} />
}
