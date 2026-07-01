'use client'

import { useState, useMemo } from 'react'
import { Store, Plus } from 'lucide-react'
import { FornecedorCard } from './FornecedorCard'
import { FornecedorFiltros as FiltrosBar } from './FornecedorFiltros'
import { SugestaoModal } from './SugestaoModal'
import { ReviewsModal } from './ReviewsModal'
import type { SupplierWithDetails, FornecedorFiltros, ProductTag } from '@/lib/fornecedores/types'

const PRODUCT_TABS: { key: ProductTag | ''; label: string; icon: string }[] = [
  { key: '',          label: 'Todos',     icon: '✨' },
  { key: 'velas',     label: 'Velas',     icon: '🕯️' },
  { key: 'sabonetes', label: 'Sabonetes', icon: '🧼' },
]

interface Props {
  suppliers: SupplierWithDetails[]
  userId: string
  initialProduto?: ProductTag | ''
}

export function FornecedoresPage({ suppliers, userId, initialProduto = '' }: Props) {
  const [produto, setProduto] = useState<ProductTag | ''>(initialProduto)
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

  function handleTabChange(key: ProductTag | '') {
    setProduto(key)
    setFiltros(f => ({ ...f, produto: '' }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#6699F3]/40 text-[#6699F3] rounded-lg hover:bg-[#6699F3]/5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Sugerir fornecedor
        </button>
      </div>

      {/* Tabs de produto */}
      <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-border/60 overflow-x-auto">
        {PRODUCT_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              produto === tab.key
                ? 'bg-[#6699F3] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

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
