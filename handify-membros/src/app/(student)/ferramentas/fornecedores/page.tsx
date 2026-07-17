import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSuppliers, getNiches, getProducts } from '@/lib/fornecedores/actions'
import { FornecedoresPage } from '@/components/ferramentas/fornecedores/FornecedoresPage'

export const metadata = { title: 'Fornecedores | Handify' }

const PRODUTO_TO_NICHE_SLUG: Record<string, string> = {
  sabonetes: 'saboaria-artesanal',
  velas:     'velas-artesanais',
}

export default async function FornecedoresRoute({
  searchParams,
}: {
  searchParams: Promise<{ nicho?: string; curso?: string; produto?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { nicho, curso, produto } = await searchParams

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

  // Busca apenas cursos que têm pelo menos um produto vinculado
  const { data: linkedCourseIds } = await service
    .from('product_course_links')
    .select('course_id')

  const uniqueCourseIds = [...new Set((linkedCourseIds ?? []).map((r: any) => r.course_id))]

  const [suppliers, niches, products, { data: coursesRaw }] = await Promise.all([
    getSuppliers(user.id),
    getNiches(),
    getProducts(),
    uniqueCourseIds.length > 0
      ? service.from('courses').select('id, title, slug').in('id', uniqueCourseIds).eq('published', true).order('title')
      : Promise.resolve({ data: [] }),
  ])

  const courses = (coursesRaw ?? []) as { id: string; title: string; slug: string }[]

  // Valida o nicho: prioriza ?nicho=<id>, depois tenta mapear ?produto=sabonetes/velas
  let validNicheId = ''
  if (nicho && niches.some(n => n.id === nicho)) {
    validNicheId = nicho
  } else if (produto) {
    const slug = PRODUTO_TO_NICHE_SLUG[produto]
    if (slug) {
      const found = niches.find(n => n.slug === slug)
      if (found) validNicheId = found.id
    }
  }

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
