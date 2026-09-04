import { redirect } from 'next/navigation'
import { getToolsForViewer } from '@/lib/ferramentas/access'
import { listarEventos } from '@/lib/calendario/actions'
import { produzPorCategorias } from '@/lib/calendario/datas'
import Calendario from '@/components/ferramentas/Calendario'

export const metadata = { title: 'Calendário do artesanato | Handify' }

export default async function CalendarioPage() {
  const [dados, { eventos, podeEditar }] = await Promise.all([getToolsForViewer(), listarEventos()])
  const tool = dados.tools.find(t => t.slug === 'calendario')

  // "Nunca some, só congela": quem já anotou datas entra mesmo sem o plano
  // ativo (só lê). Quem nunca anotou e não tem o plano vê o caminho no hub.
  if ((!tool || tool.state !== 'aberta') && eventos.length === 0) {
    redirect('/ferramentas?bloqueada=calendario')
  }

  return <Calendario eventos={eventos} podeEditar={podeEditar} planLink={dados.planLink} produzInicial={produzPorCategorias(dados.categorias)} />
}
