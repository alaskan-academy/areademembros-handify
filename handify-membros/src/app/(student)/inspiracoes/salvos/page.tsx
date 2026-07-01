import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bookmark, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getBookmarks } from '@/lib/inspiracoes/actions'
import { InspiracaoSalvos } from '@/components/inspiracoes/InspiracaoSalvos'

export const metadata = { title: 'Salvos — Inspirações | Handify' }

export default async function InspiracaoSalvosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const posts = await getBookmarks(user.id)

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/inspiracoes"
          className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
          <Bookmark className="w-5 h-5 text-[#6699F3]" />
        </div>
        <div>
          <h1 className="font-black text-xl text-foreground">Salvos</h1>
          <p className="text-sm text-muted-foreground">
            {posts.length === 0
              ? 'Nenhuma inspiração salva'
              : `${posts.length} ${posts.length === 1 ? 'inspiração salva' : 'inspirações salvas'}`}
          </p>
        </div>
      </div>

      <InspiracaoSalvos posts={posts} userId={user.id} />
    </div>
  )
}
