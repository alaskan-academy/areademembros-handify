'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Search, SlidersHorizontal, Loader2 } from 'lucide-react'
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

  const [posts, setPosts] = useState(initialPosts)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [selected, setSelected] = useState<InspiracaoPost | null>(null)

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
      <div className="mb-5 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar inspirações..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 transition-shadow"
          />
        </div>

        {/* Tipo chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {TIPOS.map(t => (
            <button
              key={t.value}
              onClick={() => setTipo(t.value)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                tipo === t.value
                  ? 'bg-[#6699F3] text-white shadow-sm'
                  : 'bg-white border border-border text-foreground/70 hover:border-[#6699F3]/50 hover:text-[#6699F3]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Nicho chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {NICHOS.map(n => (
            <button
              key={n.value}
              onClick={() => setNicho(n.value)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                nicho === n.value
                  ? 'bg-[#72CF92] text-white shadow-sm'
                  : 'bg-white border border-border text-foreground/70 hover:border-[#72CF92]/60 hover:text-[#2a9d5a]'
              )}
            >
              {n.label}
            </button>
          ))}
        </div>
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
