'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Package } from 'lucide-react'
import { adminDeleteProduct } from '@/lib/fornecedores/actions'
import type { ProductWithDetails } from '@/lib/fornecedores/types'

interface Props {
  products: ProductWithDetails[]
}

export function AdminProdutosTable({ products }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(id)
    try {
      await adminDeleteProduct(id)
    } finally {
      setDeleting(null)
    }
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border/60 rounded-xl">
        <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum produto cadastrado</p>
        <p className="text-xs text-muted-foreground mt-1">Clique em "Novo produto" para começar</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Produto</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Nichos</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Lojas</th>
            <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-20">Ativo</th>
            <th className="px-4 py-3 w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {products.map(p => (
            <tr key={p.id} className="hover:bg-muted/20 transition-colors">
              {/* Produto */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-foreground line-clamp-2">{p.name}</span>
                </div>
              </td>

              {/* Nichos — derivados das tags dos fornecedores */}
              <td className="px-4 py-3 hidden sm:table-cell">
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const tags = [...new Set(p.suppliers.flatMap(l => l.supplier.tags))]
                    return tags.length === 0
                      ? <span className="text-xs text-muted-foreground/60 italic">—</span>
                      : tags.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#6699F3]/10 text-[#6699F3] font-medium capitalize">
                            {t.replace(/-/g, ' ')}
                          </span>
                        ))
                  })()}
                </div>
              </td>

              {/* Lojas vinculadas */}
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs text-muted-foreground">
                  {p.suppliers.length === 0
                    ? '—'
                    : `${p.suppliers.length} loja${p.suppliers.length !== 1 ? 's' : ''}`}
                </span>
              </td>

              {/* Ativo */}
              <td className="px-4 py-3 text-center">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  p.active
                    ? 'bg-green-50 text-green-700'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {p.active ? 'Sim' : 'Não'}
                </span>
              </td>

              {/* Ações */}
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/admin/fornecedores/produtos/${p.id}`}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
