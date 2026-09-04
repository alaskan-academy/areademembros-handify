import { redirect } from 'next/navigation'
import { getToolsForViewer } from '@/lib/ferramentas/access'
import { listarPedidos } from '@/lib/pedidos/actions'
import Pedidos from '@/components/ferramentas/Pedidos'

export const metadata = { title: 'Pedidos e clientes | Handify' }

export default async function PedidosPage() {
  const [dados, pedidos] = await Promise.all([getToolsForViewer(), listarPedidos()])
  const tool = dados.tools.find(t => t.slug === 'pedidos-clientes')

  // "Nunca some, só congela": quem já anotou pedidos entra mesmo sem o plano
  // ativo (só lê). Quem nunca anotou e não tem o plano vê o caminho no hub.
  if ((!tool || tool.state !== 'aberta') && pedidos.pedidos.length === 0 && pedidos.clientes.length === 0) {
    redirect('/ferramentas?bloqueada=pedidos-clientes')
  }

  return <Pedidos {...pedidos} planLink={dados.planLink} />
}
