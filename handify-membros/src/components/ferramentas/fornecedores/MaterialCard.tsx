'use client'

import { ShoppingCart, Package, ExternalLink } from 'lucide-react'
import type { ProductWithDetails } from '@/lib/fornecedores/types'
import { CHANNEL_LABELS } from '@/lib/fornecedores/types'

const CHANNEL_ICONS: Record<string, string> = {
  website:      '🌐',
  instagram:    '📷',
  shopee:       '🛍',
  mercadolivre: '🛒',
}

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

        {/* Links das lojas */}
        {product.suppliers.some(l => l.supplier.channels.length > 0) && (
          <div className="flex flex-col gap-1.5">
            {product.suppliers
              .filter(l => l.supplier.channels.length > 0)
              .map(link => (
                <div key={link.supplier_id} className="flex flex-wrap items-center gap-1">
                  {product.suppliers.length > 1 && (
                    <span className="text-[10px] text-muted-foreground font-medium mr-0.5">
                      {link.supplier.name}:
                    </span>
                  )}
                  {link.supplier.channels.map(ch => (
                    <a
                      key={ch.channel}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground hover:border-[#6699F3]/60 hover:text-[#6699F3] transition-colors"
                      title={`${link.supplier.name} — ${(CHANNEL_LABELS as Record<string, string>)[ch.channel] ?? ch.channel}`}
                    >
                      <span>{CHANNEL_ICONS[ch.channel] ?? '🔗'}</span>
                      {(CHANNEL_LABELS as Record<string, string>)[ch.channel] ?? ch.channel}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ))}
                </div>
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
