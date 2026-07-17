'use client'

import { ShoppingCart, Store, Package } from 'lucide-react'
import type { ProductWithDetails } from '@/lib/fornecedores/types'

function getBestStoreUrl(channels: { channel: string; url: string }[]): string | null {
  for (const ch of ['website', 'shopee', 'mercadolivre', 'instagram']) {
    const found = channels.find(c => c.channel === ch)
    if (found) return found.url
  }
  return null
}

interface Props {
  product: ProductWithDetails
}

export function MaterialCard({ product }: Props) {
  const hasMultiple = product.suppliers.length > 1

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
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        {/* Nome */}
        <h3 className="font-semibold text-sm text-foreground leading-snug">{product.name}</h3>

        <div className="flex-1" />

        {/* Botões por fornecedor */}
        {product.suppliers.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Link em breve</p>
        ) : (
          <div className="flex flex-col gap-3">
            {hasMultiple && (
              <p className="text-[11px] text-muted-foreground font-medium">Disponível em:</p>
            )}
            {product.suppliers.map(link => {
              const storeUrl = getBestStoreUrl(link.supplier.channels)
              return (
                <div key={link.supplier_id} className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold text-foreground/70 truncate">
                    {link.supplier.name}
                  </p>
                  <a
                    href={link.buy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 bg-[#6699F3] text-white text-xs font-semibold rounded-lg hover:bg-[#5588e8] transition-colors min-h-[40px]"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                    Comprar agora
                  </a>
                  {storeUrl && (
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full py-2 px-3 border border-border/60 text-muted-foreground text-xs font-medium rounded-lg hover:border-[#6699F3]/50 hover:text-[#6699F3] transition-colors min-h-[36px]"
                    >
                      <Store className="w-3.5 h-3.5 shrink-0" />
                      Visite a loja
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
