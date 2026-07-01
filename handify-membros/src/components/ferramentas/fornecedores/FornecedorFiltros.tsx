'use client'

import { Search, X } from 'lucide-react'
import { PRODUCT_TAGS, CATEGORY_TAGS, CHANNEL_LABELS } from '@/lib/fornecedores/types'
import type { FornecedorFiltros, ProductTag, CategoryTag, Channel } from '@/lib/fornecedores/types'

interface Props {
  filtros: FornecedorFiltros
  onChange: (filtros: FornecedorFiltros) => void
  totalResultados: number
}

export function FornecedorFiltros({ filtros, onChange, totalResultados }: Props) {
  function set<K extends keyof FornecedorFiltros>(key: K, value: FornecedorFiltros[K]) {
    onChange({ ...filtros, [key]: value })
  }

  const hasFilters = filtros.produto || filtros.categoria || filtros.canal || filtros.busca

  return (
    <div className="space-y-3">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar fornecedor..."
          value={filtros.busca}
          onChange={e => set('busca', e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
        />
        {filtros.busca && (
          <button
            onClick={() => set('busca', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filtros em linha */}
      <div className="flex flex-wrap gap-2">
        {/* Produto */}
        <select
          value={filtros.produto}
          onChange={e => set('produto', e.target.value as ProductTag | '')}
          className="text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
        >
          <option value="">Todos os produtos</option>
          {Object.entries(PRODUCT_TAGS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Categoria */}
        <select
          value={filtros.categoria}
          onChange={e => set('categoria', e.target.value as CategoryTag | '')}
          className="text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORY_TAGS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Canal */}
        <select
          value={filtros.canal}
          onChange={e => set('canal', e.target.value as Channel | '')}
          className="text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
        >
          <option value="">Todos os canais</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Limpar */}
        {hasFilters && (
          <button
            onClick={() => onChange({ produto: '', categoria: '', canal: '', busca: '' })}
            className="text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-white text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Contagem */}
      <p className="text-xs text-muted-foreground">
        {totalResultados === 0
          ? 'Nenhum fornecedor encontrado'
          : `${totalResultados} fornecedor${totalResultados !== 1 ? 'es' : ''} encontrado${totalResultados !== 1 ? 's' : ''}`}
      </p>
    </div>
  )
}
