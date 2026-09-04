import { redirect } from 'next/navigation'
import { getToolsForViewer } from '@/lib/ferramentas/access'
import { listarEstoque } from '@/lib/estoque/actions'
import Estoque from '@/components/ferramentas/Estoque'

export const metadata = { title: 'Estoque de insumos | Handify' }

export default async function EstoquePage() {
  const [dados, { insumos, podeEditar }] = await Promise.all([getToolsForViewer(), listarEstoque()])
  const tool = dados.tools.find(t => t.slug === 'estoque')

  // "Nunca some, só congela": quem já anotou insumos entra mesmo sem o plano
  // ativo (só lê). Quem nunca anotou e não tem o plano vê o caminho no hub.
  if ((!tool || tool.state !== 'aberta') && insumos.length === 0) {
    redirect('/ferramentas?bloqueada=estoque')
  }

  return <Estoque insumos={insumos} podeEditar={podeEditar} planLink={dados.planLink} />
}
