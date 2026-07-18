import FerramentasHub from '@/components/ferramentas/FerramentasHub'
import { getNiches } from '@/lib/fornecedores/actions'

export const metadata = {
  title: 'Ferramentas | Handify',
}

export default async function FerramentasPage() {
  const niches = await getNiches()
  return <FerramentasHub niches={niches} />
}
