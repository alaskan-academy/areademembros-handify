import { getTier } from '@/lib/auth/access'
import SoParaAlunas from '@/components/access/SoParaAlunas'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInspiracoesFeed } from '@/lib/inspiracoes/actions'
import { InspiracaoFeed } from '@/components/inspiracoes/InspiracaoFeed'
import PageTour from "@/components/tour/PageTour"
import { SECTION_TOURS } from "@/lib/tour/tours"

export const metadata = { title: 'Inspirações — Handify' }

export default async function InspiracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Só para alunas: quem ainda não tem curso vê o que tem aqui dentro e o caminho.
  // Não abrimos nem para leitura — exporia projeto e foto das alunas.
  if ((await getTier()) === 'visitante') {
    return (
      <SoParaAlunas
        titulo="Inspirações é para alunas"
        oQueTem="É onde as alunas mostram o que fizeram: sabonete, vela, embalagem, a bancada do ateliê. Serve de ideia e de coragem para tentar."
        dentro={[
          'Fotos dos projetos das alunas, com o passo a passo que elas contam',
          'Filtro por curso e por categoria, para achar o que combina com o que você faz',
          'Salvar as que você quer copiar depois',
        ]}
      />
    )
  }

  const service = createServiceClient()
  const [page, { data: coursesRaw }, { data: categoriesRaw }, { data: profileData }] = await Promise.all([
    getInspiracoesFeed(user.id),
    service.from('courses').select('id, title').eq('published', true).eq('course_type', 'course').order('title'),
    service.from('categories').select('id, name, slug').order('name'),
    supabase.from('profiles').select('visited_sections').eq('id', user.id).single(),
  ])

  const visitedSections = (profileData?.visited_sections as Record<string, boolean>) ?? {}
  const courses = (coursesRaw ?? []) as { id: string; title: string }[]
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Hero */}
      <div className="bg-white border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-[#0F0F0F]">
            <span className="text-[#6699F3]">Inspirações</span> Handify
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Receitas, fotos, dicas e destaques do universo do artesanato.
          </p>
          <Link
            id="tour-inspiracoes-salvos"
            href="/inspiracoes/salvos"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#6699F3] border border-[#6699F3]/30 rounded-xl hover:bg-[#6699F3]/5 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
            Ver salvos
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <PageTour sectionId="inspiracoes" visited={!!visitedSections['inspiracoes']} steps={SECTION_TOURS.inspiracoes} />
        <InspiracaoFeed
          userId={user.id}
          initialPosts={page.posts}
          initialCursor={page.next_cursor}
          initialHasMore={page.has_more}
          courses={courses}
          categories={categories}
        />
      </div>
    </div>
  )
}
