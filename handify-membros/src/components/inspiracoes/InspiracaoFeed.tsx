'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Search, SlidersHorizontal, Loader2, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInspiracoesFeed } from '@/lib/inspiracoes/actions'
import type { InspiracaoPost, InspiracaoType, InspiracaoCursor } from '@/lib/inspiracoes/types'
import { InspiracaoCard } from './InspiracaoCard'
import { InspiracaoModal } from './InspiracaoModal'

const TIPOS: { value: InspiracaoType | ''; label: string }[] = [
  { value: '',          label: 'Todos' },
  { value: 'foto',      label: 'Fotos' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'video',     label: 'Vídeos' },
  { value: 'receita',   label: 'Receitas' },
  { value: 'dica',      label: 'Dicas' },
  { value: 'destaque',  label: 'Destaques' },
]

const NICHOS: { value: string; label: string }[] = [
  { value: '',           label: 'Todos' },
  { value: 'velas',      label: 'Velas' },
  { value: 'sabonetes',  label: 'Sabonetes' },
  { value: 'costura',    label: 'Costura' },
  { value: 'croche',     label: 'Crochê' },
  { value: 'tricot',     label: 'Tricot' },
  { value: 'macrame',    label: 'Macramê' },
  { value: 'decoupage',  label: 'Decoupage' },
  { value: 'pintura',    label: 'Pintura' },
]

interface Props {
  userId: string
  initialPosts: InspiracaoPost[]
  initialCursor: InspiracaoCursor | null
  initialHasMore: boolean
}

export function InspiracaoFeed({ userId, initialPosts, initialCursor, initialHasMore }: Props) {
  const [tipo, setTipo] = useState<InspiracaoType | ''>('')
  const [nicho, setNicho] = useState('')
  const [busca, setBusca] = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [posts, setPosts] = useState(initialPosts)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [selected, setSelected] = useState<InspiracaoPost | null>(null)

  const activeFilterCount = (tipo !== '' ? 1 : 0) + (nicho !== '' ? 1 : 0)

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
        nicho: nicho || undefined,
        busca: debouncedBusca || undefined,
      })
      setPosts(page.posts)
      setCursor(page.next_cursor)
      setHasMore(page.has_more)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, nicho, debouncedBusca])

  function loadMore() {
    if (!hasMore || !cursor) return
    startLoadMore(async () => {
      const page = await getInspiracoesFeed(
        userId,
        { tipo: tipo || undefined, nicho: nicho || undefined, busca: debouncedBusca || undefined },
        cursor
      )
      setPosts(prev => [...prev, ...page.posts])
      setCursor(page.next_cursor)
      setHasMore(page.has_more)
    })
  }

  return (
    <>
      {/* Filtros */}
      <div className="mb-5 space-y-2">
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
              <span className="w-4 h-4 rounded-full bg-[#6699F3] text-white text-[10px] font-bold flex items-center justify-center leading-none">
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tipo</p>
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

            {/* Nicho */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Artesanato</p>
              <div className="flex flex-wrap gap-1.5">
                {NICHOS.map(n => (
                  <button
                    key={n.value}
                    onClick={() => setNicho(n.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      nicho === n.value
                        ? 'bg-[#72CF92] text-white shadow-sm'
                        : 'bg-muted/60 text-foreground/70 hover:bg-[#72CF92]/15 hover:text-[#2a9d5a]'
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Limpar */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setTipo(''); setNicho('') }}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {posts.map(post => (
              <InspiracaoCard
                key={post.id}
                post={post}
                userId={userId}
                onClick={() => setSelected(post)}
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

      {/* Modal */}
      {selected && (
        <InspiracaoModal
          post={selected}
          userId={userId}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
