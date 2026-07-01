'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Edit, BadgeCheck, Search, X } from 'lucide-react'

interface Channel { channel: string }
interface Tag { tag: string }
interface Supplier {
  id: string
  name: string
  verified: boolean
  active: boolean
  position: number
  logo_url?: string | null
  supplier_tags?: Tag[]
  supplier_channels?: Channel[]
}

export function AdminFornecedoresTable({ suppliers }: { suppliers: Supplier[] }) {
  const [busca, setBusca] = useState('')

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.supplier_tags ?? []).some(t => t.tag.toLowerCase().includes(q))
    )
  }, [suppliers, busca])

  return (
    <div className="space-y-3">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou tag..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-border/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 focus:border-[#6699F3]"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {suppliers.length} fornecedor{suppliers.length !== 1 ? 'es' : ''}
      </p>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Canais</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  Nenhum fornecedor encontrado para &quot;{busca}&quot;.
                </td>
              </tr>
            ) : (
              filtered.map(s => {
                const tags = (s.supplier_tags ?? []).map(t => t.tag)
                const channels = s.supplier_channels ?? []
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.logo_url ? (
                          <img src={s.logo_url} alt="" className="w-8 h-8 rounded object-contain border border-border/40" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">{s.name[0]}</div>
                        )}
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-xs">{s.name}</span>
                            {s.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#6699F3]" aria-label="Verificado Handify" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                        ))}
                        {tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{channels.length} canal{channels.length !== 1 ? 'is' : ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {s.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/fornecedores/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs text-[#6699F3] hover:underline"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
