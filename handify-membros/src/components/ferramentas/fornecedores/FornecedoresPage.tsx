'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Store, Plus, Package, X, BookOpen, ChevronDown, Check } from 'lucide-react'
import { FornecedorCard } from './FornecedorCard'
import { MaterialCard } from './MaterialCard'
import { SugestaoModal } from './SugestaoModal'
import { ReviewsModal } from './ReviewsModal'
import type {
  SupplierWithDetails,
  ProductWithDetails,
  NicheRow,
} from '@/lib/fornecedores/types'

type Tab = 'materiais' | 'lojas'

interface Props {
  suppliers: SupplierWithDetails[]
  products: ProductWithDetails[]
  niches: NicheRow[]
  userId: string
  initialNicheId?: string
  courseFilter?: { id: string; title: string } | null
}

export function FornecedoresPage({
  suppliers,
  products,
  niches,
  userId,
  initialNicheId = '',
  courseFilter = null,
}: Props) {
  const [tab, setTab] = useState<Tab>('materiais')
  const [selectedNiche, setSelectedNiche] = useState(initialNicheId)
  const [busca, setBusca] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sugestaoOpen, setSugestaoOpen] = useState(false)
  const [reviewSupplier, setReviewSupplier] = useState<SupplierWithDetails | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Nichos que têm pelo menos um produto vinculado
  const nichesWithProducts = useMemo(() => {
    const ids = new Set(products.flatMap(p => p.niches.map(n => n.id)))
    return new Set(ids)
  }, [products])

  // Nichos que têm pelo menos um fornecedor vinculado (via supplier_tags, usando slug)
  const nichesWithSuppliers = useMemo(() => {
    const slugSet = new Set(suppliers.flatMap(s => s.tags))
    return new Set(niches.filter(n => slugSet.has(n.slug)).map(n => n.id))
  }, [suppliers, niches])

  // Apenas nichos com conteúdo em pelo menos uma das abas
  const activeNiches = useMemo(
    () => niches.filter(n => nichesWithProducts.has(n.id) || nichesWithSuppliers.has(n.id)),
    [niches, nichesWithProducts, nichesWithSuppliers]
  )

  const selectedNicheName = activeNiches.find(n => n.id === selectedNiche)?.name ?? ''

  // Produtos filtrados por nicho + busca
  const filteredProducts = useMemo(() => {
    let result = products
    if (selectedNiche) result = result.filter(p => p.niches.some(n => n.id === selectedNiche))
    if (busca) {
      const q = busca.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }
    return result
  }, [products, selectedNiche, busca])

  // Fornecedores filtrados por nicho (via tag = slug) + busca
  const filteredSuppliers = useMemo(() => {
    let result = suppliers
    if (selectedNiche) {
      const slug = activeNiches.find(n => n.id === selectedNiche)?.slug ?? ''
      if (slug) result = result.filter(s => s.tags.includes(slug))
    }
    if (busca) {
      const q = busca.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [suppliers, selectedNiche, activeNiches, busca])

  function selectNiche(id: string) {
    setSelectedNiche(id)
    setDropdownOpen(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-[#6699F3]" />
            <h2 className="text-lg font-bold text-foreground">Fornecedores</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Materiais e lojas de confiança para suas produções artesanais.
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

      {/* Badge de filtro por curso */}
      {courseFilter && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#6699F3]/8 border border-[#6699F3]/20 rounded-xl">
          <BookOpen className="w-4 h-4 text-[#6699F3] shrink-0" />
          <span className="text-sm text-[#6699F3] font-semibold flex-1">
            Materiais do curso: {courseFilter.title}
          </span>
          <a
            href="/ferramentas/fornecedores"
            className="p-1 rounded-lg hover:bg-[#6699F3]/15 transition-colors"
            title="Limpar filtro de curso"
          >
            <X className="w-4 h-4 text-[#6699F3]" />
          </a>
        </div>
      )}

      {/* Dropdown de nicho — retrátil, compartilhado entre abas */}
      {activeNiches.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white border border-border/60 rounded-xl text-sm font-medium hover:border-[#6699F3]/40 transition-colors"
          >
            <span className={selectedNiche ? 'text-[#6699F3] font-semibold' : 'text-muted-foreground'}>
              {selectedNiche ? selectedNicheName : 'Todos os nichos'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedNiche && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); selectNiche('') }}
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                  title="Limpar filtro"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-border/60 rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => selectNiche('')}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors ${
                  !selectedNiche
                    ? 'bg-[#6699F3]/8 text-[#6699F3] font-semibold'
                    : 'text-foreground hover:bg-gray-50'
                }`}
              >
                Todos os nichos
                {!selectedNiche && <Check className="w-4 h-4 shrink-0" />}
              </button>
              {activeNiches.map(n => (
                <button
                  key={n.id}
                  onClick={() => selectNiche(n.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors border-t border-border/30 ${
                    selectedNiche === n.id
                      ? 'bg-[#6699F3]/8 text-[#6699F3] font-semibold'
                      : 'text-foreground hover:bg-gray-50'
                  }`}
                >
                  {n.name}
                  {selectedNiche === n.id && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        <button
          onClick={() => setTab('materiais')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'materiais'
              ? 'bg-white text-[#6699F3] shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="w-4 h-4" />
          Materiais
        </button>
        <button
          onClick={() => setTab('lojas')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            tab === 'lojas'
              ? 'bg-white text-[#6699F3] shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Store className="w-4 h-4" />
          Lojas e Marcas
        </button>
      </div>

      {/* Busca */}
      <input
        type="search"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder={tab === 'materiais' ? 'Buscar material…' : 'Buscar loja ou marca…'}
        className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]/50 transition-colors"
      />

      {/* ── Aba Materiais ── */}
      {tab === 'materiais' && (
        filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {products.length === 0 ? 'Nenhum material cadastrado ainda' : 'Nenhum material encontrado'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {products.length === 0 ? 'Em breve teremos uma lista completa para você!' : 'Tente outro nicho ou limpe a busca'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map(p => (
              <MaterialCard key={p.id} product={p} />
            ))}
          </div>
        )
      )}

      {/* ── Aba Lojas e Marcas ── */}
      {tab === 'lojas' && (
        filteredSuppliers.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma loja encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedNiche ? 'Nenhuma loja com esse nicho. Tente "Todos os nichos".' : 'Tente ajustar a busca'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map(s => (
              <FornecedorCard
                key={s.id}
                supplier={s}
                userId={userId}
                onOpenReviews={setReviewSupplier}
              />
            ))}
          </div>
        )
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
