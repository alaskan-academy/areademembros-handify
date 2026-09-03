import FerramentasHub from '@/components/ferramentas/FerramentasHub'
import { getToolsForViewer } from '@/lib/ferramentas/access'
import { createClient } from '@/lib/supabase/server'
import PageTour from "@/components/tour/PageTour"
import { SECTION_TOURS } from "@/lib/tour/tours"

export const metadata = {
  title: 'Ferramentas | Handify',
}

export default async function FerramentasPage({
  searchParams,
}: {
  searchParams: Promise<{ bloqueada?: string }>
}) {
  const { bloqueada } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // A lista e o estado de cada ferramenta (aberta, trancada e por quê) vêm
  // do banco: a admin decide tier e categorias sem deploy.
  const [dados, profileResult] = await Promise.all([
    getToolsForViewer(),
    user
      ? supabase.from('profiles').select('visited_sections').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const visitedSections = (profileResult?.data?.visited_sections as Record<string, boolean>) ?? {}

  return (
    <div>
      {user && <PageTour sectionId="ferramentas" visited={!!visitedSections['ferramentas']} steps={SECTION_TOURS.ferramentas} />}
      <div id="tour-ferramentas-hub">
        <FerramentasHub dados={dados} bloqueada={bloqueada} />
      </div>
    </div>
  )
}
