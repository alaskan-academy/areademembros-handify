'use client'

import { ShoppingCart, Package } from 'lucide-react'
import type { ProductWithDetails } from '@/lib/fornecedores/types'

interface Props {
  product: ProductWithDetails
}

export function MaterialCard({ product }: Props) {
  const hasMultiple = product.suppliers.length > 1

  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Foto do produto */}
      <div className="relative w-full aspect-square bg-muted overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Nome */}
        <h3 className="font-semibold text-sm text-foreground leading-snug">{product.name}</h3>

        {/* Nichos */}
        {product.niches.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.niches.map(n => (
              <span
                key={n.id}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#6699F3]/10 text-[#6699F3] capitalize"
              >
                {n.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Botões de compra */}
        {product.suppliers.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Link em breve</p>
        ) : product.suppliers.length === 1 ? (
          <a
            href={product.suppliers[0].buy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#6699F3] text-white text-sm font-semibold rounded-lg hover:bg-[#5588e8] transition-colors min-h-[44px]"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            Comprar agora
          </a>
        ) : (
          <div className="flex flex-col gap-2">
            {hasMultiple && (
              <p className="text-[11px] text-muted-foreground font-medium">Disponível em:</p>
            )}
            {product.suppliers.map(link => (
              <a
                key={link.supplier_id}
                href={link.buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#6699F3] text-white text-sm font-semibold rounded-lg hover:bg-[#5588e8] transition-colors min-h-[44px]"
              >
                {link.supplier?.logo_url ? (
                  <img
                    src={link.supplier.logo_url}
                    alt=""
                    className="w-4 h-4 rounded object-contain bg-white shrink-0"
                  />
                ) : (
                  <ShoppingCart className="w-4 h-4 shrink-0" />
                )}
                Comprar na {link.supplier?.name ?? 'loja'}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
