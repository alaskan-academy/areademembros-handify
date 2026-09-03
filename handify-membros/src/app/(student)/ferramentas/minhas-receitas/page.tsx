import { redirect } from 'next/navigation'
import { getToolsForViewer } from '@/lib/ferramentas/access'
import { listarReceitas } from '@/lib/receitas/actions'
import MinhasReceitas from '@/components/ferramentas/MinhasReceitas'

export const metadata = { title: 'Minhas receitas | Handify' }

export default async function MinhasReceitasPage() {
  const [dados, { receitas, podeEditar }] = await Promise.all([getToolsForViewer(), listarReceitas()])
  const tool = dados.tools.find(t => t.slug === 'minhas-receitas')

  // "Nunca some, só congela": quem tem receitas guardadas entra mesmo sem o
  // plano ativo (só lê). Quem nunca guardou nada e não tem o plano vê o
  // caminho na lista de ferramentas.
  if ((!tool || tool.state !== 'aberta') && receitas.length === 0) {
    redirect('/ferramentas?bloqueada=minhas-receitas')
  }

  return <MinhasReceitas receitas={receitas} podeEditar={podeEditar} planLink={dados.planLink} />
}
