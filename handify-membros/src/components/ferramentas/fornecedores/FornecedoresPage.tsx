'use client'

import { useState, useMemo } from 'react'
import { Store, Plus } from 'lucide-react'
import { FornecedorCard } from './FornecedorCard'
import { FornecedorFiltros as FiltrosBar } from './FornecedorFiltros'
import { SugestaoModal } from './SugestaoModal'
import { ReviewsModal } from './ReviewsModal'
import type { SupplierWithDetails, FornecedorFiltros } from '@/lib/fornecedores/types'

interface Props {
  suppliers: SupplierWithDetails[]
  userId: string
  categories?: { id: string; name: string; slug: string }[]
  initialProduto?: string
}

export function FornecedoresPage({ suppliers, userId, categories = [], initialProduto = '' }: Props) {
  const [produto, setProduto] = useState<string>(initialProduto)
  const [filtros, setFiltros] = useState<FornecedorFiltros>({
    produto: '', categoria: '', canal: '', busca: '',
  })
  const [sugestaoOpen, setSugestaoOpen] = useState(false)
  const [reviewSupplier, setReviewSupplier] = useState<SupplierWithDetails | null>(null)

  const filtered = useMemo(() => {
    let result = suppliers
    if (produto)          result = result.filter(s => s.tags.includes(produto))
    if (filtros.categoria) result = result.filter(s => s.tags.includes(filtros.categoria))
    if (filtros.canal)     result = result.filter(s => s.channels.some(c => c.channel === filtros.canal))
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [suppliers, produto, filtros])

  function handleTabChange(key: string) {
    setProduto(key)
    setFiltros(f => ({ ...f, produto: '' }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-[#6699F3]" />
            <h2 className="text-lg font-bold text-foreground">Fornecedores</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Lista curada de fornecedores de confiança para suas produções artesanais.
          </p>
        </div>
        <button
          onClick={() => setSugestaoOpen(true)}
          className="self-start sm:shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Sugerir fornecedor
        </button>
      </div>

      {/* Toggle de categoria (nicho) */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 bg-white rounded-2xl p-1.5 border border-border/60">
          <button
            onClick={() => handleTabChange('')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-bold px-3 py-2.5 rounded-xl transition-all ${
              produto === ''
                ? 'bg-[#6699F3] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.slug}
              onClick={() => handleTabChange(cat.slug)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-bold px-3 py-2.5 rounded-xl transition-all ${
                produto === cat.slug
                  ? 'bg-[#6699F3] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Filtros de categoria / canal / busca */}
      <FiltrosBar
        filtros={filtros}
        onChange={setFiltros}
        totalResultados={filtered.length}
        hideProduto
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Store className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum fornecedor encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <FornecedorCard
              key={s.id}
              supplier={s}
              userId={userId}
              onOpenReviews={setReviewSupplier}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {sugestaoOpen && (
        <SugestaoModal userId={userId} onClose={() => setSugestaoOpen(false)} />
      )}
      {reviewSupplier && (
        <ReviewsModal
          supplier={reviewSupplier}
          userId={userId}
          onClose={() => setReviewSupplier(null)}
        />
      )}
    </div>
  )
}
