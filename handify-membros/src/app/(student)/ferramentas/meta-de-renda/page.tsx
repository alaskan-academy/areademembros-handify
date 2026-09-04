import { assertToolAccess } from '@/lib/ferramentas/access'
import { listarCatalogo } from '@/lib/catalogo/actions'
import MetaDeRenda from '@/components/ferramentas/MetaDeRenda'

export const metadata = {
  title: 'Meta de renda | Handify',
  description: 'Quanto vender, a que preço, para ganhar o que você quer por mês.',
}

export default async function MetaDeRendaPage() {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  await assertToolAccess('meta-de-renda')

  // Quem tem catálogo (Completo) entra com preço e custo médios preenchidos.
  const { produtos } = await listarCatalogo()
  const ativos = produtos.filter(p => p.active && p.price > 0)
  const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null)
  const precoInicial = media(ativos.map(p => p.price))
  const custoInicial = media(ativos.map(p => p.receita?.cost_per_unit).filter((c): c is number => c != null && c > 0))

  return <MetaDeRenda precoInicial={precoInicial} custoInicial={custoInicial} />
}
