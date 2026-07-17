'use client'

import { useState } from 'react'
import { ShoppingCart, Package, ExternalLink, Heart, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleProductFavorite } from '@/lib/fornecedores/actions'
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
  userId: string
  onOpenReviews: (product: ProductWithDetails) => void
}

export function MaterialCard({ product, userId, onOpenReviews }: Props) {
  const [fav, setFav] = useState(product.isFavorite)
  const [loading, setLoading] = useState(false)

  async function handleFav() {
    if (loading) return
    setLoading(true)
    setFav(v => !v)
    try {
      await toggleProductFavorite(userId, product.id, fav)
    } catch {
      setFav(v => !v)
    }
    setLoading(false)
  }

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

        {/* Favorito */}
        <button
          onClick={handleFav}
          disabled={loading}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm transition-colors',
            fav ? 'text-red-500 hover:bg-red-50' : 'text-foreground/30 hover:text-red-400 hover:bg-red-50'
          )}
          title={fav ? 'Remover dos favoritos' : 'Salvar produto'}
        >
          <Heart className="w-3.5 h-3.5" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        <h3 className="font-semibold text-sm text-foreground leading-snug">{product.name}</h3>

        {/* Lojas vinculadas */}
        {product.suppliers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.suppliers.map(link => {
              const siteUrl = getBestStoreUrl(link.supplier.channels)
              return siteUrl ? (
                <a
                  key={link.supplier_id}
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6699F3] hover:underline"
                >
                  {link.supplier.name}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span key={link.supplier_id} className="text-[11px] font-medium text-muted-foreground">
                  {link.supplier.name}
                </span>
              )
            })}
          </div>
        )}

        <div className="flex-1" />

        {/* Botão(ões) de compra */}
        {product.suppliers.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Link em breve</p>
        ) : product.suppliers.length === 1 ? (
          <a
            href={product.suppliers[0].buy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 bg-[#6699F3] text-white text-xs font-semibold rounded-lg hover:bg-[#5588e8] transition-colors min-h-[40px]"
          >
            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
            Comprar agora
          </a>
        ) : (
          <div className="flex flex-col gap-1.5">
            {product.suppliers.map(link => (
              <a
                key={link.supplier_id}
                href={link.buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-[#6699F3] text-white text-xs font-semibold rounded-lg hover:bg-[#5588e8] transition-colors min-h-[38px]"
              >
                <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                Comprar na {link.supplier.name}
              </a>
            ))}
          </div>
        )}

        {/* Comentários */}
        <button
          onClick={() => onOpenReviews(product)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {product.reviewCount === 0
            ? 'Seja a primeira a comentar'
            : `${product.reviewCount} comentário${product.reviewCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
