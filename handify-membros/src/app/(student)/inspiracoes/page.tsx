import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInspiracoesFeed } from '@/lib/inspiracoes/actions'
import { InspiracaoFeed } from '@/components/inspiracoes/InspiracaoFeed'

export const metadata = { title: 'Inspirações — Handify' }

export default async function InspiracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const [page, { data: coursesRaw }, { data: categoriesRaw }] = await Promise.all([
    getInspiracoesFeed(user.id),
    service
      .from('courses')
      .select('id, title')
      .eq('published', true)
      .eq('course_type', 'course')
      .order('title'),
    service
      .from('categories')
      .select('id, name, slug')
      .order('name'),
  ])
  const courses = (coursesRaw ?? []) as { id: string; title: string }[]
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Hero */}
      <div className="bg-white border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center">
          <p className="text-sm font-medium text-[#6699F3] uppercase tracking-wide mb-3">
            Comunidade
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0F0F0F]">
            <span className="text-[#6699F3]">Inspirações</span> Handify
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Receitas, fotos, dicas e destaques do universo do artesanato.
          </p>
          <Link
            href="/inspiracoes/salvos"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#6699F3] border border-[#6699F3]/30 rounded-xl hover:bg-[#6699F3]/5 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
            Ver salvos
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
