import FerramentasHub from '@/components/ferramentas/FerramentasHub'
import { getNiches } from '@/lib/fornecedores/actions'
import { createClient } from '@/lib/supabase/server'
import PageTour from "@/components/tour/PageTour"
import { SECTION_TOURS } from "@/lib/tour/tours"

export const metadata = {
  title: 'Ferramentas | Handify',
}

export default async function FerramentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [niches, profileResult] = await Promise.all([
    getNiches(),
    user
      ? supabase.from('profiles').select('visited_sections').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const visitedSections = (profileResult?.data?.visited_sections as Record<string, boolean>) ?? {}

  return (
    <div>
      {user && <PageTour sectionId="ferramentas" visited={!!visitedSections['ferramentas']} steps={SECTION_TOURS.ferramentas} />}
      <div id="tour-ferramentas-hub">
        <FerramentasHub niches={niches} />
      </div>
    </div>
  )
}
