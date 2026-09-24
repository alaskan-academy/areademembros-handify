import { getTier } from '@/lib/auth/access'
import SoParaAlunas from '@/components/access/SoParaAlunas'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInspiracoesFeed, cursosComAcervo, getInspiracaoById } from '@/lib/inspiracoes/actions'
import { InspiracaoFeed } from '@/components/inspiracoes/InspiracaoFeed'
import { lerDeepLink, type ParamsDaUrl } from '@/components/inspiracoes/deep-link'
import PageTour from "@/components/tour/PageTour"
import { SECTION_TOURS } from "@/lib/tour/tours"

export const metadata = { title: 'Inspirações — Handify' }

export default async function InspiracoesPage({
  searchParams,
}: {
  searchParams: Promise<ParamsDaUrl>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `/inspiracoes?post=<postId>&comentario=<commentId>` — contrato com a
  // moderação e com a notificação de resposta, que geram este link.
  const deepLink = lerDeepLink(await searchParams)

  // Tudo de uma vez. O tier vinha numa linha antes, e aí a página esperava uma
  // ida inteira ao banco só para saber se podia começar a buscar o resto.
  //
  // Para a visitante, as consultas abaixo rodam e voltam vazias — a RLS de
  // `inspiration_posts` só abre para admin, plano ativo ou matrícula viva. Ela
  // vê o mesmo muro de antes; o que muda é que as 4.538 alunas param de esperar.
  const [tier, page, cursosRaw, { data: profileData }, postDoLink] = await Promise.all([
    getTier(),
    getInspiracoesFeed(user.id),
    cursosComAcervo(user.id),
    supabase.from('profiles').select('visited_sections').eq('id', user.id).single(),
    deepLink ? getInspiracaoById(deepLink.postId, user.id) : Promise.resolve(null),
  ])

  // Só para alunas: quem ainda não tem curso vê o que tem aqui dentro e o caminho.
  // O acervo (receitas, dicas, vídeos) acompanha o curso — quem publica é a equipe.
  if (tier === 'visitante') {
    return (
      <SoParaAlunas
        titulo="Inspirações é para alunas"
        oQueTem="É o acervo da Handify: receita, dica, vídeo e foto para você aplicar o que aprendeu. Um lugar para folhear quando bate a dúvida do que fazer hoje."
        dentro={[
          'Receitas prontas para copiar e adaptar ao que você já faz',
          'Dicas curtas e vídeos de quem faz todo dia',
          'Filtro por curso e por categoria, e busca pelo que você quer',
          'Curtir, comentar e salvar o que quiser fazer depois',
        ]}
        porQue="É conteúdo que a equipe publica para quem está aprendendo com a gente — receita testada e dica de quem faz todo dia. Com um curso, ele abre inteiro."
      />
    )
  }

  // O post do deep link é buscado por id no servidor, junto do resto da
  // página: chega pronto no primeiro render, sem piscar, e sem depender de a
  // rolagem infinita alcançar a página em que ele está. `getInspiracaoById`
  // devolve null quando o post não existe, foi despublicado ou arquivado — aí a
  // tela é o feed normal, com um aviso.
  const visitedSections = (profileData?.visited_sections as Record<string, boolean>) ?? {}
  const courses = cursosRaw

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
          postDoLink={postDoLink}
          comentarioDoLink={deepLink?.comentarioId ?? null}
          linkPerdido={!!deepLink && !postDoLink}
          ignorarCadeadoDoCurso={tier === 'admin'}
        />
      </div>
    </div>
  )
}
