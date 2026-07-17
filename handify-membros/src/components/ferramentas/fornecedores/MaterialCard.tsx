'use client'

import { Package, ExternalLink } from 'lucide-react'
import type { ProductWithDetails } from '@/lib/fornecedores/types'

interface Props {
  product: ProductWithDetails
}

export function MaterialCard({ product }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Foto */}
      <div className="relative w-full aspect-square bg-muted overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-sm text-foreground leading-snug">{product.name}</h3>

        {/* Lojas vinculadas com link de compra */}
        {product.suppliers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {product.suppliers.map(link => (
              <a
                key={link.supplier_id}
                href={link.buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6699F3] hover:underline"
              >
                {link.supplier.name}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Link em breve</p>
        )}
      </div>
    </div>
  )
}
