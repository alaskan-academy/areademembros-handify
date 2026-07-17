import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSuppliers, getNiches, getProducts } from '@/lib/fornecedores/actions'
import { FornecedoresPage } from '@/components/ferramentas/fornecedores/FornecedoresPage'

export const metadata = { title: 'Fornecedores | Handify' }

export default async function FornecedoresRoute({
  searchParams,
}: {
  searchParams: Promise<{ nicho?: string; curso?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { nicho, curso } = await searchParams

  // Resolve curso pelo slug → id
  let courseFilter: { id: string; title: string } | null = null
  if (curso) {
    const service = createServiceClient()
    const { data: course } = await service
      .from('courses')
      .select('id, title')
      .eq('slug', curso)
      .single()
    if (course) courseFilter = { id: course.id, title: course.title }
  }

  const service = createServiceClient()
  const [suppliers, niches, products, { data: coursesRaw }] = await Promise.all([
    getSuppliers(user.id),
    getNiches(),
    getProducts(undefined, courseFilter?.id),
    service.from('courses').select('id, title, slug').eq('published', true).order('title'),
  ])

  const courses = (coursesRaw ?? []) as { id: string; title: string; slug: string }[]

  // Valida o nicho da query string
  const validNicheId = nicho && niches.some(n => n.id === nicho) ? nicho : ''

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <FornecedoresPage
        suppliers={suppliers}
        products={products}
        niches={niches}
        courses={courses}
        userId={user.id}
        initialNicheId={validNicheId}
        courseFilter={courseFilter}
      />
    </div>
  )
}
