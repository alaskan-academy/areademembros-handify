import FerramentasHub from '@/components/ferramentas/FerramentasHub'
import { getNiches } from '@/lib/fornecedores/actions'
import { createClient } from '@/lib/supabase/server'
import SectionWelcomeBanner from '@/components/onboarding/SectionWelcomeBanner'
import { ONBOARDING_SECTIONS } from '@/lib/onboarding/sections'

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
  const ferramentasSection = ONBOARDING_SECTIONS.find((s) => s.id === 'ferramentas')!

  return (
    <div>
      {user && !visitedSections['ferramentas'] && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <SectionWelcomeBanner section={ferramentasSection} />
        </div>
      )}
      <FerramentasHub niches={niches} />
    </div>
  )
}
