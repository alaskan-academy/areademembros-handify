import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInspiracoesFeed } from '@/lib/inspiracoes/actions'
import { InspiracaoFeed } from '@/components/inspiracoes/InspiracaoFeed'

export const metadata = { title: 'Inspirações — Handify' }

export default async function InspiracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = await getInspiracoesFeed(user.id)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-[#6699F3]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-xl sm:text-2xl text-foreground">Inspirações</h1>
          <p className="text-sm text-muted-foreground">Receitas, fotos, dicas e destaques</p>
        </div>
        <Link
          href="/inspiracoes/salvos"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#6699F3] border border-[#6699F3]/30 rounded-xl hover:bg-[#6699F3]/5 transition-colors"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Salvos
        </Link>
      </div>

      <InspiracaoFeed
        userId={user.id}
        initialPosts={page.posts}
        initialCursor={page.next_cursor}
        initialHasMore={page.has_more}
      />
    </div>
  )
}
