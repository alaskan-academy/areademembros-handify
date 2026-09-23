'use client'

import { useState, useEffect, useLayoutEffect, useRef, useTransition } from 'react'
import { Search, SlidersHorizontal, Loader2, ChevronDown, X, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInspiracoesFeed } from '@/lib/inspiracoes/actions'
import type { InspiracaoPost, InspiracaoType, InspiracaoCursor, CursoDoFiltro } from '@/lib/inspiracoes/types'
import { InspiracaoFeedItem } from './InspiracaoFeedItem'
import { CursoBloqueadoModal } from './CursoBloqueadoModal'
import { InspiracaoModal } from './InspiracaoModal'
import { cursoBloqueadoDoPost, limparParametrosDoDeepLink } from './deep-link'

const TIPOS: { value: InspiracaoType | ''; label: string }[] = [
  { value: '',          label: 'Todos' },
  { value: 'foto',      label: 'Fotos' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'video',     label: 'Vídeos' },
  { value: 'receita',   label: 'Receitas' },
  { value: 'dica',      label: 'Dicas' },
  { value: 'destaque',  label: 'Destaques' },
]

/**
 * useLayoutEffect no navegador; no servidor cai no useEffect só para o React
 * não avisar (nenhum dos dois roda lá).
 */
const useEfeitoDeLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface Props {
  userId: string
  initialPosts: InspiracaoPost[]
  initialCursor: InspiracaoCursor | null
  initialHasMore: boolean
  courses?: CursoDoFiltro[]
  /**
   * Post pedido por `/inspiracoes?post=…`, já buscado POR ID no servidor.
   *
   * Buscado por id, e não procurado entre os posts já carregados, porque o
   * feed é paginado por cursor: a inspiração da notificação pode estar na
   * página 7 e a aluna nunca chegaria nela rolando.
   */
  postDoLink?: InspiracaoPost | null
  /** Comentário pedido por `&comentario=…` — o painel rola até ele. */
  comentarioDoLink?: string | null
  /** true quando veio `?post=` mas o post não existe mais (ou foi arquivado). */
  linkPerdido?: boolean
  /**
   * Admin abrindo o link da fila de moderação.
   *
   * A Jessica não tem matrícula nos cursos, então o cadeado do curso a barraria
   * justamente no caminho que ela pediu: clicar no comentário da fila, chegar
   * ao post e ver onde a aluna comentou. Ela veria o convite de compra.
   */
  ignorarCadeadoDoCurso?: boolean
}

export function InspiracaoFeed({
  userId,
  initialPosts,
  initialCursor,
  initialHasMore,
  courses = [],
  postDoLink = null,
  comentarioDoLink = null,
  linkPerdido = false,
  ignorarCadeadoDoCurso = false,
}: Props) {
  const [tipo, setTipo] = useState<InspiracaoType | ''>('')
  const [courseId, setCourseId] = useState('')

  // O link profundo tem três destinos possíveis, decididos uma vez só, no
  // primeiro render: abrir o post, abrir o convite do curso que ela não tem,
  // ou nada (o feed normal, com um aviso).
  const bloqueioDoLink = postDoLink && !ignorarCadeadoDoCurso
    ? cursoBloqueadoDoPost(postDoLink, courses)
    : null

  const [postAberto, setPostAberto] = useState<InspiracaoPost | null>(
    postDoLink && !bloqueioDoLink ? postDoLink : null
  )
  const [cursoBloqueado, setCursoBloqueado] = useState<CursoDoFiltro | null>(bloqueioDoLink)
  const [avisoLinkPerdido, setAvisoLinkPerdido] = useState(linkPerdido)

  // Tira `?post=` e `?comentario=` da barra de endereço assim que o link foi
  // lido — antes de a aluna fechar o modal. O useModalBackGuard empilha uma
  // entrada ao abrir e chama history.back() ao fechar: se os parâmetros ainda
  // estivessem lá, o voltar (e o F5) reabririam o modal que ela acabou de
  // fechar. Ver o comentário em deep-link.ts.
  //
  // Precisa ser efeito de LAYOUT: os efeitos do filho rodam antes dos do pai, e
  // o useModalBackGuard (que é do modal, filho daqui) guarda a URL do instante
  // em que abriu. Efeito de layout do pai roda antes de qualquer efeito comum
  // de filho, então o guard já encontra a URL limpa.
  useEfeitoDeLayout(() => { limparParametrosDoDeepLink() }, [])

  const [busca, setBusca] = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [posts, setPosts] = useState(initialPosts)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)

  const activeFilterCount = (tipo !== '' ? 1 : 0) + (courseId !== '' ? 1 : 0)

  const [isFetching, startFetch] = useTransition()
  const [isLoadingMore, startLoadMore] = useTransition()

  const isFirst = useRef(true)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusca(busca), 450)
    return () => clearTimeout(t)
  }, [busca])

  // Re-fetch when filters change (skip initial mount)
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    startFetch(async () => {
      const page = await getInspiracoesFeed(userId, {
        tipo: tipo || undefined,
        curso_id: courseId || undefined,
        busca: debouncedBusca || undefined,
      })
      setPosts(page.posts)
      setCursor(page.next_cursor)
      setHasMore(page.has_more)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, courseId, debouncedBusca])

  function loadMore() {
    if (!hasMore || !cursor) return
    startLoadMore(async () => {
      const page = await getInspiracoesFeed(
        userId,
        { tipo: tipo || undefined, curso_id: courseId || undefined, busca: debouncedBusca || undefined },
        cursor
      )
      setPosts(prev => [...prev, ...page.posts])
      setCursor(page.next_cursor)
      setHasMore(page.has_more)
    })
  }

  return (
    <>
      {/* O link da notificação apontava para um post que saiu do ar. Sem este
          aviso ela toca na notificação, cai no topo do feed e conclui que a
          plataforma está quebrada. */}
      {avisoLinkPerdido && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-xl border border-[#FEC649]/50 bg-[#FEC649]/10 px-4 py-3"
        >
          <p className="flex-1 text-xs leading-relaxed text-[#2D2D2D]">
            Esta inspiração saiu do ar — a equipe pode ter arquivado o post. O resto do acervo
            continua aqui embaixo.
          </p>
          <button
            onClick={() => setAvisoLinkPerdido(false)}
            aria-label="Fechar aviso"
            className="-my-2 -mr-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground handify-transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div id="tour-inspiracoes-filtros" className="mb-5 space-y-2">
        {/* Linha: busca + botão filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar inspirações..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 transition-shadow"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(v => !v)}
            aria-label="Filtros"
            aria-expanded={filtersOpen}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors',
              filtersOpen || activeFilterCount > 0
                ? 'border-[#6699F3] text-[#6699F3] bg-[#6699F3]/5'
                : 'border-border text-foreground/60 hover:border-[#6699F3]/50 hover:text-[#6699F3]'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#6699F3] text-white text-xs font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', filtersOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Painel retrátil */}
        {filtersOpen && (
          <div className="bg-white rounded-xl border border-border/70 p-4 space-y-4">
            {/* Tipo */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      tipo === t.value
                        ? 'bg-[#6699F3] text-white shadow-sm'
                        : 'bg-muted/60 text-foreground/70 hover:bg-[#6699F3]/10 hover:text-[#6699F3]'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>


            {/* Curso */}
            {courses.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Curso</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCourseId('')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      courseId === ''
                        ? 'bg-[#FEC649] text-[#6b4f00] shadow-sm'
                        : 'bg-muted/60 text-foreground/70 hover:bg-[#FEC649]/20 hover:text-[#6b4f00]'
                    )}
                  >
                    Todos
                  </button>
                  {courses.map(c =>
                    c.temAcesso ? (
                      <button
                        key={c.id}
                        onClick={() => setCourseId(c.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                          courseId === c.id
                            ? 'bg-[#FEC649] text-[#6b4f00] shadow-sm'
                            : 'bg-muted/60 text-foreground/70 hover:bg-[#FEC649]/20 hover:text-[#6b4f00]'
                        )}
                      >
                        {c.title}
                      </button>
                    ) : (
                      // Curso que ela não tem: cinza, com cadeado. O clique abre o
                      // convite em vez de filtrar — some da lista seria pior, ela
                      // nem saberia que existe conteúdo ali.
                      <button
                        key={c.id}
                        onClick={() => setCursoBloqueado(c)}
                        aria-label={`${c.title} — você ainda não tem este curso`}
                        className="px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1 bg-muted/40 text-foreground/35 hover:text-foreground/55 hover:bg-muted/70 transition-colors"
                      >
                        <Lock className="w-3 h-3" aria-hidden />
                        {c.title}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Limpar */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setTipo(''); setCourseId('') }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {isFetching ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#6699F3] animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">Nenhuma inspiração encontrada</p>
          <p className="text-xs mt-1">Tente outros filtros</p>
        </div>
      ) : (
        <>
          <div className="max-w-2xl mx-auto space-y-5">
            {posts.map(post => (
              <InspiracaoFeedItem
                key={post.id}
                post={post}
                userId={userId}
                cursos={courses}
                onCursoBloqueado={setCursoBloqueado}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-[#6699F3] border border-[#6699F3]/40 rounded-xl hover:bg-[#6699F3]/5 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Carregando...</>
                ) : (
                  'Carregar mais'
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Um modal de cada vez: dois useModalBackGuard abertos juntos empilhariam
          duas entradas no histórico e o botão voltar precisaria de dois toques. */}
      {postAberto ? (
        <InspiracaoModal
          post={postAberto}
          userId={userId}
          comentarioId={comentarioDoLink}
          onClose={() => setPostAberto(null)}
        />
      ) : cursoBloqueado ? (
        <CursoBloqueadoModal curso={cursoBloqueado} onClose={() => setCursoBloqueado(null)} />
      ) : null}
    </>
  )
}
