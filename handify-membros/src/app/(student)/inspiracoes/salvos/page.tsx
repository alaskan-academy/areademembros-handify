import { getTier } from '@/lib/auth/access'
import SoParaAlunas from '@/components/access/SoParaAlunas'
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

  // Só para alunas: quem ainda não tem curso vê o que tem aqui dentro e o caminho.
  // O acervo (receitas, dicas, vídeos) acompanha o curso — quem publica é a equipe.
  if ((await getTier()) === 'visitante') {
    return (
      <SoParaAlunas
        titulo="Inspirações é para alunas"
        oQueTem="Aqui ficam as receitas e dicas que você salvou para fazer depois."
        dentro={[
          'Receitas prontas para copiar e adaptar ao que você já faz',
          'Dicas curtas e vídeos de quem faz todo dia',
          'Tudo que você salvar fica guardado aqui',
        ]}
        porQue="É conteúdo que a equipe publica para quem está aprendendo com a gente — receita testada e dica de quem faz todo dia. Com um curso, ele abre inteiro."
      />
    )
  }

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
